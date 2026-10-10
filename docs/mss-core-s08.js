/* LearnSphere - SQL Server Core DBA, Section 08: Concurrency, Locking & Isolation.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const acid=M.dg(700,150,[
[10,25,150,70,'Atomicity|all or nothing',0],[190,25,150,70,'Consistency|rules stay true',0],
[370,25,150,70,'Isolation|sessions do not|trample each other',2],[550,25,140,70,'Durability|committed = kept|(the log)',0]],
[]);

const lock=M.dg(700,200,[
[10,15,210,170,'Granularity (smallest to largest)',1],
[30,50,170,30,'Row or key',0],[30,90,170,30,'Page',0],[30,130,170,30,'Table',2],
[250,15,210,170,'Common modes',1],
[270,50,170,30,'S shared (read)',0],[270,90,170,30,'X exclusive (write)',2],[270,130,170,30,'U update, IS, IX intent',0],
[490,15,200,170,'Compatible?',1],
[505,50,170,30,'S and S: yes',0],[505,90,170,30,'S and X: no, block',2],[505,130,170,30,'X and X: no, block',2]],
[]);

const block=M.dg(700,150,[
[10,30,150,70,'Session A|holds X lock|on row 1',2],[230,30,150,70,'Session B|wants row 1|waits (blocked)',0],
[450,30,230,70,'B waits until A commits|or rolls back.|Long transactions = long waits.',0]],
[[160,65,230,65],[380,65,450,65]]);

const dead=M.dg(700,200,[
[10,20,170,70,'Session A|holds row 1',2],[10,120,170,70,'Session B|holds row 2',2],
[260,20,170,70,'A waits for|row 2',0],[260,120,170,70,'B waits for|row 1',0],
[490,60,200,80,'Cycle: engine picks a|victim, rolls it back,|returns error 1205',0]],
[[180,55,260,55],[180,155,260,155],[345,90,95,120],[345,120,95,90]]);

/* ---------- 0: ACID ---------- */
L['mss-core:7:0']={blocks:[
{p:'A **transaction** is a group of operations that succeed or fail as one. SQL Server follows the **ACID** rules so that concurrent users see correct data.'},
{svg:acid},
{h:'Transaction types'},
{t:[['Mode','Behavior'],
['**Autocommit** (default)','Each statement is its own transaction'],
['**Explicit**','`BEGIN TRAN` ... `COMMIT` or `ROLLBACK`'],
['**Implicit**','`SET IMPLICIT_TRANSACTIONS ON`: a transaction starts automatically']]},
{code:`SET XACT_ABORT ON;      -- any runtime error rolls back the whole transaction
BEGIN TRY
  BEGIN TRAN;
    UPDATE sales.Accounts SET Balance = Balance - 100 WHERE AccountID = 1;
    UPDATE sales.Accounts SET Balance = Balance + 100 WHERE AccountID = 2;
  COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  THROW;
END CATCH;`},
{h:'Keep transactions short'},
{ul:['Do **not** wait for user input inside a transaction.','Touch only what you need, and in a **consistent order**.','Open late, commit early.','An open transaction holds locks and prevents log reuse.']},
{note:'Check @@TRANCOUNT before commit or rollback in a CATCH block. Forgetting to roll back leaves locks open and is a very common cause of mysterious blocking.'}],
src:[['Transactions (Transact-SQL)',M.TS+'language-elements/transactions-transact-sql'],['Transaction locking and row versioning guide',M.RD+'sql-server-transaction-locking-and-row-versioning-guide']]};

/* ---------- 1: Locks and latches ---------- */
L['mss-core:7:1']={blocks:[
{p:'To keep transactions isolated, SQL Server uses **locks**. A DBA must know what locks are, what **modes** they have and how they block each other.'},
{svg:lock},
{h:'Lock modes'},
{t:[['Mode','Used for','Compatible with'],
['**S** shared','Reading','Other S'],
['**X** exclusive','Writing','Nothing'],
['**U** update','Reading before an update, to avoid deadlock','S, not U or X'],
['**IS, IX, SIX** intent','Signals a lock at a lower level','Other intent locks']]},
{h:'Granularity and escalation'},
{p:'Locks can be taken at row, page or table level. SQL Server may **escalate** many row or page locks to one table lock (at about 5,000 locks in a statement) to save memory. Escalation can cause wide blocking.'},
{h:'Latches are different'},
{t:[['','Lock','Latch'],
['**Protects**','Data, for transaction isolation','Internal memory structures'],
['**Duration**','Until commit (usually)','Very short'],
['**Control**','Isolation level and hints','Engine only']]},
{code:`-- Current locks
SELECT request_session_id, resource_type, request_mode, request_status,
       resource_associated_entity_id
FROM   sys.dm_tran_locks
WHERE  resource_database_id = DB_ID();`},
{note:'Seeing many locks is normal. The problem is a lock that is held a long time or a request that is waiting. Look at status WAIT and at the blocker.'}],
src:[['sys.dm_tran_locks',M.RD+'system-dynamic-management-views/sys-dm-tran-locks-transact-sql'],['Lock escalation',M.RD+'sql-server-transaction-locking-and-row-versioning-guide']]};

/* ---------- 2: Isolation levels ---------- */
L['mss-core:7:2']={blocks:[
{p:'The **isolation level** decides how much one transaction is shielded from the changes of others. Higher isolation means more correctness and more locking.'},
{h:'Phenomena to understand'},
{ul:['**Dirty read**: reading data that another transaction has not committed.','**Non-repeatable read**: reading the same row twice and getting different values.','**Phantom**: running the same query twice and getting different sets of rows.']},
{h:'The levels'},
{t:[['Level','Dirty read','Non-repeatable','Phantom','Notes'],
['**READ UNCOMMITTED**','Possible','Possible','Possible','Same as NOLOCK. Avoid for accuracy'],
['**READ COMMITTED** (default)','No','Possible','Possible','Readers take short S locks'],
['**READ COMMITTED SNAPSHOT (RCSI)**','No','Possible','Possible','Readers use row versions, not locks'],
['**REPEATABLE READ**','No','No','Possible','Holds S locks until commit'],
['**SNAPSHOT**','No','No','No','Transaction sees a consistent snapshot'],
['**SERIALIZABLE**','No','No','No','Range locks, most blocking']]},
{code:`-- Per session
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Current session level
DBCC USEROPTIONS;

-- Database settings
SELECT name, is_read_committed_snapshot_on, snapshot_isolation_state_desc
FROM   sys.databases;`},
{note:'NOLOCK is not a free speed trick. It can return rows twice, skip rows and show data that is later rolled back. Prefer RCSI for read performance without blocking.'}],
src:[['SET TRANSACTION ISOLATION LEVEL',M.TS+'statements/set-transaction-isolation-level-transact-sql'],['Isolation levels in the Database Engine',M.RD+'sql-server-transaction-locking-and-row-versioning-guide']]};

/* ---------- 3: RCSI and snapshot ---------- */
L['mss-core:7:3']={blocks:[
{p:'With **row versioning**, a reader gets a committed version of a row instead of waiting for a lock. Writers do not block readers, and readers do not block writers.'},
{h:'How it works'},
{flow:['A row is changed: the old committed version is copied to the version store','Readers read the old version, not the locked row','Versions are cleaned up when no transaction needs them','Space used: tempdb (or the PVS when ADR is on)']},
{h:'Two ways to use it'},
{t:[['Feature','Scope','Setting'],
['**RCSI** (read committed snapshot)','Statement level, every READ COMMITTED query','`READ_COMMITTED_SNAPSHOT ON`'],
['**Snapshot isolation**','Transaction level, you opt in','`ALLOW_SNAPSHOT_ISOLATION ON` then `SET TRANSACTION ISOLATION LEVEL SNAPSHOT`']]},
{code:`-- RCSI: needs exclusive access briefly
ALTER DATABASE SalesDB SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;

-- Snapshot isolation
ALTER DATABASE SalesDB SET ALLOW_SNAPSHOT_ISOLATION ON;

-- Version store usage
SELECT DB_NAME(database_id) AS db, reserved_page_count*8/1024 AS version_store_mb
FROM   sys.dm_tran_version_store_space_usage;`},
{h:'Costs and traps'},
{ul:['Extra **tempdb** or PVS space and I/O.','Long-running transactions keep old versions alive and let the store grow.','**Snapshot** can raise error **3960** (update conflict) when two transactions change the same row.','Code that relied on readers being blocked may behave differently.']},
{note:'RCSI is the default for new Azure SQL databases. On-premises it is usually a safe improvement, but test the application first.'}],
src:[['Snapshot isolation in SQL Server',M.SQL+'connect/ado-net/sql/snapshot-isolation-sql-server'],['sys.dm_tran_version_store_space_usage',M.RD+'system-dynamic-management-views/sys-dm-tran-version-store-space-usage']]};

/* ---------- 4: Blocking and deadlocks ---------- */
L['mss-core:7:4']={blocks:[
{p:'**Blocking** and **deadlocks** are the two main concurrency problems. Blocking is waiting. A deadlock is a cycle: nobody can ever finish, so SQL Server kills one.'},
{h:'Blocking'},
{svg:block},
{code:`-- Who is blocked and by whom
SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_time, r.command,
       DB_NAME(r.database_id) AS db
FROM   sys.dm_exec_requests r
WHERE  r.blocking_session_id <> 0;

-- What is the head blocker doing
SELECT s.session_id, s.login_name, s.status, s.open_transaction_count, t.text
FROM   sys.dm_exec_sessions s
LEFT   JOIN sys.dm_exec_connections c ON c.session_id = s.session_id
OUTER  APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) t
WHERE  s.session_id = 55;   -- replace with the head blocker`},
{h:'Deadlock'},
{svg:dead},
{ul:['The engine picks a **victim** (the cheapest to roll back) and returns **error 1205**.','The victim must **retry** its transaction.','Deadlock graphs are captured by the **system_health** Extended Events session.']},
{h:'Prevention'},
{t:[['Cause','Fix'],
['Long transactions','Make them shorter, commit sooner'],
['Missing indexes','Add the right index so fewer rows are locked'],
['Different access order','Always access tables in the same order'],
['Readers blocked by writers','Use RCSI'],
['No retry in the app','Add retry logic for error 1205']]},
{note:'Killing a session rolls back its work, which can take as long as the work did. Fix the cause (open transaction, missing commit, bad query) rather than only killing.'}],
src:[['SQL Server deadlocks guide',M.RD+'sql-server-deadlocks-guide'],['Understand and resolve SQL Server blocking problems','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/understand-resolve-blocking']]};

})();
