/* LearnSphere - SQL Server Performance & Tuning, Section 09: Blocking & Deadlocks.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const chain=M.dg(700,170,[
[10,35,120,60,'SPID 70|head blocker|sleeping, open tran',2],[170,35,120,60,'SPID 82|blocked by 70',0],[330,35,120,60,'SPID 91|blocked by 82',0],[490,35,120,60,'SPID 95|blocked by 91',0],
[10,115,680,40,'Fix the head of the chain. Killing the others changes nothing.',0]],
[[130,65,170,65],[290,65,330,65],[450,65,490,65]]);

const dl=M.dg(700,190,[
[10,20,170,60,'Process A|holds key 1|wants key 2',2],[10,115,170,60,'Process B|holds key 2|wants key 1',2],
[250,20,200,60,'Resource list|key lock objects|and modes',0],[250,115,200,60,'Victim list|process rolled back',0],
[490,60,200,70,'Captured by system_health|Extended Events|as xml_deadlock_report',0]],
[[180,50,250,50],[180,145,250,145],[450,90,490,90]]);

const red=M.dg(700,190,[
[10,15,215,160,'Reduce time',1],[25,50,185,30,'Shorter transactions',0],[25,90,185,30,'Faster queries',2],[25,130,185,30,'Better indexes',0],
[245,15,215,160,'Reduce conflicts',1],[260,50,185,30,'Read committed snapshot',2],[260,90,185,30,'Same object order',0],[260,130,185,30,'Smaller batches',0],
[480,15,210,160,'Handle it',1],[495,50,180,30,'Retry on 1205',0],[495,90,180,30,'Lock timeout',0],[495,130,180,30,'Alert on long waits',0]],
[]);

const esc=M.dg(700,150,[
[10,25,200,70,'Row locks|accumulate in one|statement',0],[250,25,200,70,'About 5,000 locks|or memory pressure|triggers escalation',2],[490,25,200,70,'One table lock|other sessions|are blocked',2]],
[[210,60,250,60],[450,60,490,60]]);

const lng=M.dg(700,170,[
[10,25,150,70,'BEGIN TRAN|work|no COMMIT',2],[190,25,170,70,'Holds locks|blocks others|keeps log active',0],[390,25,150,70,'Version store|and log grow',0],[570,25,120,70,'Find with|OPENTRAN|and DMVs',0],
[10,115,680,40,'Usual causes: app waits for the user, error path without rollback, forgotten connection',0]],
[[160,60,190,60],[360,60,390,60],[540,60,570,60]]);

/* ---------- 0: Head blocker ---------- */
L['mss-perf:8:0']={blocks:[
{p:'Blocking is a **chain**. The session at the head is the one to understand. It often looks innocent: **sleeping**, with an **open transaction**.'},
{svg:chain},
{code:`-- Blocking chain with the head blocker marked
WITH chain AS (
  SELECT session_id, blocking_session_id, wait_type, wait_time, 0 AS lvl
  FROM   sys.dm_exec_requests WHERE blocking_session_id <> 0
)
SELECT DISTINCT b.session_id AS head_blocker, s.login_name, s.host_name, s.program_name,
       s.status, s.open_transaction_count, s.last_request_start_time, t.text AS last_sql
FROM   chain c
JOIN   sys.dm_exec_sessions b ON b.session_id = c.blocking_session_id
JOIN   sys.dm_exec_sessions s ON s.session_id = b.session_id
LEFT   JOIN sys.dm_exec_requests r ON r.session_id = b.session_id AND r.blocking_session_id = 0
OUTER  APPLY sys.dm_exec_sql_text(
        (SELECT most_recent_sql_handle FROM sys.dm_exec_connections WHERE session_id = b.session_id)) t
WHERE  b.session_id NOT IN (SELECT session_id FROM chain);`},
{h:'What to read'},
{t:[['Clue','Meaning'],
['**status = sleeping, open_transaction_count > 0**','Application opened a transaction and is idle'],
['**status = running**, long CPU','The blocker is a long query'],
['**wait_type = LCK_M_***','What kind of lock the blocked session needs'],
['**wait_resource**','The exact key, page or object, decodable with sys.dm_tran_locks']]},
{note:'Killing the head blocker rolls back its work, which can take as long as the work did. Prefer to understand and fix the code, and kill only when the business agrees.'}],
src:[['Understand and resolve blocking problems','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/performance/understand-resolve-blocking'],['sys.dm_tran_locks',M.RD+'system-dynamic-management-views/sys-dm-tran-locks-transact-sql']]};

/* ---------- 1: Deadlock graphs ---------- */
L['mss-perf:8:1']={blocks:[
{p:'A **deadlock graph** is the evidence you need. It shows both processes, the statements they ran, the resources and who was chosen as the victim.'},
{svg:dl},
{h:'Get the graph'},
{code:`-- From the always-on system_health session
SELECT xed.value('@timestamp', 'datetime2') AS deadlock_time,
       xed.query('.') AS deadlock_xml
FROM  (SELECT CAST(target_data AS xml) AS td
       FROM   sys.dm_xe_session_targets st
       JOIN   sys.dm_xe_sessions s ON s.address = st.event_session_address
       WHERE  s.name = 'system_health' AND st.target_name = 'ring_buffer') x
CROSS  APPLY td.nodes('RingBufferTarget/event[@name="xml_deadlock_report"]') t(xed);`},
{h:'How to read it'},
{flow:['Find the victim (marked in victim-list)','Read each process: the statement, the isolation level, the host and application','Read the resource list: which objects, indexes and keys','See who holds and who waits for each resource','Decide: order of access, missing index, isolation, shorter transaction']},
{note:'SSMS can open a deadlock graph saved with the .xdl extension as a diagram, which is easier to read than raw XML. The ring buffer keeps only recent events, so read the system_health files for older ones.'}],
src:[['SQL Server deadlocks guide',M.RD+'sql-server-deadlocks-guide'],['system_health session',M.RD+'extended-events/use-the-system-health-session']]};

/* ---------- 2: Reducing blocking ---------- */
L['mss-perf:8:2']={blocks:[
{p:'Most blocking is caused by transactions that hold locks **too long** or by queries that lock **too much**. Both are fixable.'},
{svg:red},
{t:[['Cause','Fix'],
['A query scans a large table and locks rows','Add an index so only needed rows are touched'],
['Readers wait for writers','Enable READ_COMMITTED_SNAPSHOT'],
['Long transactions','Commit sooner, move non-database work out'],
['Large batch updates','Update in chunks of a few thousand rows'],
['Different access order','Always touch objects in the same order'],
['Hot rows','Redesign counters, queue tables']]},
{code:`-- Update in small batches to keep locks short
WHILE 1 = 1
BEGIN
  UPDATE TOP (4000) sales.Orders SET Archived = 1 WHERE Archived = 0 AND OrderDate < '2025-01-01';
  IF @@ROWCOUNT = 0 BREAK;
  WAITFOR DELAY '00:00:01';
END;`},
{note:'Setting LOCK_TIMEOUT or short command timeouts makes problems visible but does not remove them. Use them together with real fixes.'}],
src:[['Transaction locking and row versioning guide',M.RD+'sql-server-transaction-locking-and-row-versioning-guide'],['SET LOCK_TIMEOUT',M.TS+'statements/set-lock-timeout-transact-sql']]};

/* ---------- 3: Lock escalation ---------- */
L['mss-perf:8:3']={blocks:[
{p:'**Lock escalation** converts many fine locks into one coarse lock to save memory. It is useful on large updates, and harmful when it blocks everyone else.'},
{svg:esc},
{h:'When it happens'},
{ul:['A single statement takes about **5,000 locks** on one object, or lock memory is high.','The new lock is a **table** (or partition) lock, not row or page.','It is not undone while the transaction continues.']},
{code:`-- Table-level control
ALTER TABLE sales.Orders SET (LOCK_ESCALATION = AUTO);   -- partition level on partitioned tables
-- Options: TABLE (default), AUTO, DISABLE

-- How often did escalation occur and fail?
SELECT OBJECT_NAME(object_id) AS table_name, index_id,
       index_lock_promotion_attempt_count AS attempts, index_lock_promotion_count AS promoted
FROM   sys.dm_db_index_operational_stats(DB_ID(), NULL, NULL, NULL)
WHERE  index_lock_promotion_attempt_count > 0;`},
{h:'Ways to avoid trouble'},
{ul:['**Batch** large operations under 5,000 rows per statement.','**Index** the predicate so fewer locks are needed.','Use **RCSI** for readers so escalation does not block selects.','Use **partition-level** escalation (AUTO) on partitioned tables.']}],
src:[['Lock escalation',M.RD+'sql-server-transaction-locking-and-row-versioning-guide'],['ALTER TABLE SET LOCK_ESCALATION',M.TS+'statements/alter-table-transact-sql']]};

/* ---------- 4: Long-running transactions ---------- */
L['mss-perf:8:4']={blocks:[
{p:'A **long-running transaction** holds locks, keeps the log from being reused and stops version store cleanup. It is behind a large share of blocking and log-full incidents.'},
{svg:lng},
{code:`-- Oldest open transaction
DBCC OPENTRAN;

-- All open transactions with session and duration
SELECT st.session_id, s.login_name, s.host_name, s.program_name, s.status,
       at.transaction_begin_time,
       DATEDIFF(minute, at.transaction_begin_time, GETDATE()) AS minutes_open,
       s.open_transaction_count
FROM   sys.dm_tran_session_transactions st
JOIN   sys.dm_tran_active_transactions at ON at.transaction_id = st.transaction_id
JOIN   sys.dm_exec_sessions s ON s.session_id = st.session_id
ORDER  BY at.transaction_begin_time;`},
{h:'Typical causes and fixes'},
{t:[['Cause','Fix'],
['Application starts a transaction and waits for the user','Move user waits outside the transaction'],
['Error path without rollback','Use TRY/CATCH and `SET XACT_ABORT ON`'],
['Connection pool returns connections with open transactions','Fix the app, set command timeouts'],
['Huge batch in one transaction','Chunk the work']]},
{note:'Add an alert for transactions open longer than a few minutes. It finds the problem before users call.'}],
src:[['sys.dm_tran_active_transactions',M.RD+'system-dynamic-management-views/sys-dm-tran-active-transactions-transact-sql'],['DBCC OPENTRAN',M.TS+'database-console-commands/dbcc-opentran-transact-sql']]};

})();
