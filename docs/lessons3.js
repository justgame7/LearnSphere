/* LearnSphere: explanatory text inserted after the first paragraph of existing lessons */
(function(){
const A=(k,b)=>{const L=window.LESSONS[k];if(L)L.blocks.splice(1,0,...b)};

A('pg:0:0',[
{h:'Key definitions'},
{p:'A **database** is an organised collection of data stored so it can be searched and updated reliably. A **DBMS** (database management system) is the software that manages it: it stores the data, enforces rules, lets many users work at once and recovers after failures. An **RDBMS** is a DBMS that organises data into **tables** made of rows and columns, linked by keys, and queried with **SQL**. PostgreSQL is an RDBMS.'},
{h:'What this course assumes and how to use it'},
{p:'You need basic SQL (SELECT, INSERT, UPDATE) and comfort with a Linux shell. The course is ordered the way a real server is born: you install it, learn how it works inside, then secure, protect and scale it. Each lesson has a concept explanation, a table or diagram, and commands to practise. Read the explanation first, then run the commands on a throwaway VM, and break things on purpose. A DBA learns most from failures you caused in a safe place.'}]);

A('pg:0:1',[
{h:'Where PostgreSQL came from'},
{p:'The project began at the University of California, Berkeley in 1986, led by Michael Stonebraker, as **POSTGRES**, a successor to the earlier Ingres system. In 1994-95 students added a SQL interpreter and it became **Postgres95**. In 1996 it was renamed **PostgreSQL** to show SQL support, and a global volunteer community has developed it ever since. It is released under the permissive PostgreSQL License, so it is free for commercial use with no vendor owning it.'},
{h:'What object-relational means'},
{p:'A pure relational database stores rows in tables with a fixed set of built-in types. PostgreSQL is also **object-relational**: you can define your own data types, operators, functions and index methods, tables can inherit from other tables, and it has rich built-in types such as `jsonb`, arrays, ranges, UUIDs and network addresses. Example: one table can hold ordinary columns plus a `jsonb` document column, and you can index inside the JSON.'},
{h:'ACID, with an example'},
{p:'ACID describes the guarantees of a **transaction**, a group of statements that succeed or fail together. Take a bank transfer of 100 from account A to B. **Atomicity**: either both the debit and the credit happen, or neither. **Consistency**: rules such as "balance cannot be negative" are never violated. **Isolation**: another session reading mid-transfer does not see a half-finished state. **Durability**: once COMMIT returns, the transfer survives a power cut, which PostgreSQL achieves by writing the Write-Ahead Log to disk first.'},
{h:'MVCC, with an example'},
{p:'**Multi-Version Concurrency Control** means an UPDATE does not overwrite a row; it creates a new version and keeps the old one. Session 1 starts a long report; Session 2 updates a customer row. Session 1 still sees the old version because its snapshot was taken earlier, and Session 2 is never blocked by the report. The price is that old versions pile up as **dead tuples**, which VACUUM must later clean. This is why autovacuum is a core DBA topic.'},
{h:'Extensibility in practice'},
{p:'Extensions add features without changing the core: **PostGIS** (geographic data), **pg_stat_statements** (query statistics), **pgcrypto** (encryption), **postgres_fdw** (query other databases). Install one with `CREATE EXTENSION name;`.'}]);

A('pg:0:2',[
{h:'What a DBA actually does'},
{p:'A DBA is responsible for the data being **available** (the database is up when needed), **safe** (only the right people see it and it cannot be lost) and **fast enough** (queries meet expectations). Work is both **proactive** (capacity planning, tested backups, patching, monitoring) and **reactive** (a disk filling up, a runaway query, a failed server).'},
{h:'A typical day, as an example'},
{p:'Morning: check monitoring and overnight backup results. Midday: a developer asks for a new read-only account, so you create a role with only the needed GRANTs. Afternoon: a report is slow, so you look at `pg_stat_activity` and the query plan and add an index. Evening: you plan next month patch window. At 3 a.m. an alert fires because the WAL directory is growing; you find an abandoned replication slot holding WAL and drop it. Every lesson in this course maps to a moment like these.'},
{h:'DBA versus developer'},
{p:'A developer designs tables and writes queries for a feature. A DBA runs the platform they live on: the server, configuration, security, recovery and performance across all applications. Good DBAs know SQL well and good developers understand the basics of how the server works; this course gives you the DBA side.'}]);

A('pg:0:3',[
{h:'Why the numbering matters'},
{p:'The major version tells you whether the **on-disk data format** and system catalogs may have changed. A cluster created by 17 cannot be opened by 18 binaries; that is why major upgrades need `pg_upgrade` or dump and restore. A minor release never changes the format, so you stop the server, replace the binaries and start it again. Example: moving from 18.1 to 18.3 takes minutes and needs no data migration.'},
{h:'Why you must keep up'},
{p:'Minor releases contain security and data-corruption fixes, so running the latest minor release is the cheapest protection you have. After a major version reaches **end of life** it no longer receives fixes at all, so plan a major upgrade well before year five.'}]);

A('pg:3:0',[
{h:'What a process is, and why PostgreSQL uses many'},
{p:'A **process** is a running program with its own memory space managed by the operating system. PostgreSQL runs as a family of cooperating processes rather than one large program, so a fault in one client session cannot overwrite another session private memory. The **postmaster** (the executable is simply `postgres`) is the parent of the family. Think of it as a reception desk: it does not do the work itself, it welcomes each visitor, hands them to a dedicated assistant, and keeps the building running.'},
{h:'What happens when the server starts'},
{p:'On `pg_ctl start` the postmaster reads `postgresql.conf` and `pg_hba.conf`, creates the **shared memory** segment and semaphores, and writes `postmaster.pid`. It then starts the **startup process**, which checks whether the last shutdown was clean; if not it replays WAL (crash recovery). Once the database is consistent it starts the background processes and begins accepting connections. If you see "the database system is starting up" while connecting, recovery is still in progress.'},
{h:'Why it is kept so simple'},
{p:'The postmaster deliberately avoids touching shared memory or running SQL. If it did, a bug in one query could corrupt the process everyone depends on. When a child process dies abnormally, the postmaster assumes shared memory may be damaged, terminates all sessions, re-initialises memory and runs recovery. Clients see "terminating connection because of crash of another server process" and can reconnect moments later.'}]);

A('pg:3:1',[
{h:'Definition and analogy'},
{p:'A **backend process** is the server-side partner of one client connection. If the postmaster is reception, the backend is your personal assistant for the whole visit: it checks your identity, takes your requests one at a time, does the work and reports back. It lives exactly as long as the connection.'},
{h:'A connection, step by step'},
{p:'(1) The client sends a connection request to port 5432. (2) The postmaster accepts it and **forks** a new process. (3) The backend reads the startup packet, finds the first matching `pg_hba.conf` rule and authenticates the user, for example with SCRAM. (4) It attaches to shared memory and sets up local memory. (5) It waits for SQL, runs each statement and returns results until the client disconnects or is terminated.'},
{h:'The five query stages with an example'},
{p:'Take `SELECT name FROM emp WHERE id = 5;`. The **parser** checks the syntax. The **analyzer** confirms that table `emp` and columns `name` and `id` exist and resolves their types. The **rewriter** expands views or rules (none here). The **planner** compares options, such as scanning the whole table or using an index on `id`, estimates the cost of each from table statistics and picks the cheapest. The **executor** carries out the plan, fetching pages through shared buffers, and sends the row back. `EXPLAIN` shows you the planner choice.'},
{h:'The cost of many connections'},
{p:'Each connection is an OS process with its own memory, so thousands of idle connections waste RAM and slow scheduling. Applications should use a **connection pool** (PgBouncer or the app framework pool) so a few dozen backends serve many clients. Keep `max_connections` modest and increase it only with a reason.'}]);

A('pg:3:2',[
{h:'Why background processes exist'},
{p:'If backends had to do every housekeeping job themselves, user queries would stall. Background processes move slow work off the critical path. Each is started by the postmaster and restarted automatically if it exits.'},
{h:'What each one does, in plain language'},
{p:'The **checkpointer** works like pressing Save on a document: periodically it writes every changed page to the data files and marks a checkpoint in WAL, so crash recovery only has to replay from that point. The **background writer** trickles out dirty pages between checkpoints so backends find clean buffers to reuse. The **WAL writer** flushes the WAL buffer regularly so commits do not all wait for a single big write. **Autovacuum** launches workers that clear dead row versions left by MVCC and update planner statistics; without it tables bloat and eventually risk transaction ID wraparound. The **archiver** copies full WAL segments to a safe location, the basis of point-in-time recovery. **WAL sender** and **receiver** processes stream WAL between a primary and its standby servers.'},
{h:'See them yourself'},
{p:'Run `ps -ef | grep postgres` on the server, or query `pg_stat_activity` and look at the `backend_type` column. A healthy idle server shows a postmaster, checkpointer, background writer, WAL writer and autovacuum launcher.'}]);

A('pg:3:3',[
{h:'Shared versus local memory'},
{p:'**Shared memory** is one region created at startup that every PostgreSQL process can read and write. Its main parts are the **buffer cache** (`shared_buffers`), the **WAL buffers**, and bookkeeping such as lock tables and transaction status caches. **Local memory** is private to one backend and is allocated as needed: `work_mem` for sorts and hash joins, `maintenance_work_mem` for VACUUM and index builds, `temp_buffers` for temporary tables.'},
{h:'The 8 KB page and the buffer cache'},
{p:'PostgreSQL stores tables and indexes in fixed **8 KB pages**. When a query needs a row, the backend asks the buffer manager for the page. If it is already in `shared_buffers` (a **cache hit**) no disk read is needed. If not, the page is read from the file, usually from the OS page cache, into a free buffer. Because PostgreSQL also relies on the operating system cache, `shared_buffers` is typically set to around a quarter of RAM rather than almost all of it; `effective_cache_size` simply tells the planner how much total caching to assume.'},
{h:'Why work_mem needs care'},
{p:'`work_mem` is granted **per sort or hash operation, per query**, not per server. A query with three such steps on 100 connections could use 100 x 3 x 4 MB = 1.2 GB at the default 4 MB, and far more if you raise it carelessly. Raise it per session for a heavy report (`SET work_mem = \'256MB\';`) rather than globally.'},
{h:'Measuring cache efficiency'},
{code:`SELECT datname,
       round(100.0*blks_hit/nullif(blks_hit+blks_read,0),2) AS hit_pct
FROM pg_stat_database;
-- OLTP systems usually aim for above 99%`}]);

A('pg:3:4',[
{h:'What a write-ahead log is'},
{p:'A **log** is an append-only record of changes. The write-ahead rule says: **the log record describing a change must reach disk before the changed data page does.** Think of an accountant who writes each transaction in a journal before updating the ledger. If the ledger is lost halfway, the journal can rebuild it.'},
{h:'A crash example'},
{p:'You UPDATE a row and COMMIT. The new page is still only in memory and the power fails. On restart the startup process finds the last checkpoint, reads WAL from there and **redoes** each logged change, so your committed update reappears. Transactions that never committed leave no durable effect. Without WAL you would have to flush every data page on every commit, which is very slow because the writes are scattered; WAL turns commit into one fast sequential write.'},
{h:'Reading the key terms'},
{p:'The **LSN** (Log Sequence Number) is a position in the WAL stream, like a page number in the journal. WAL is stored as **16 MB segment files** in `pg_wal`, named with the timeline, log and segment numbers. A **checkpoint** is the moment all changes before a given LSN are known to be in the data files; the checkpointer runs one every `checkpoint_timeout` or when WAL reaches `max_wal_size`. With `full_page_writes` on, the first change to a page after a checkpoint logs the whole page, protecting against partly written (torn) pages.'},
{h:'What else WAL powers'},
{p:'The same stream gives you **point-in-time recovery** (restore a base backup, replay archived WAL to a chosen moment), **streaming replication** (standbys replay the primary WAL) and **logical decoding**. That is why WAL appears again in the backup and replication sections.'}]);

A('pg:3:5',[
{h:'A worked example: UPDATE'},
{p:'Run `UPDATE emp SET sal = 6000 WHERE id = 5;` and then COMMIT. (1) The backend plans the query and finds the page holding row 5, reading it into `shared_buffers` if it is not there. (2) It does not edit the old row: it writes a **new row version** with sal 6000 and marks the old one as expired by this transaction. The page is now **dirty**. (3) It writes a WAL record describing the change into the WAL buffers. (4) At COMMIT the backend forces WAL up to that point to disk with fsync and records the transaction as committed; only now does the client get "COMMIT". (5) Later the background writer or checkpointer writes the dirty page to the data file. (6) After no snapshot needs the old version, autovacuum removes it.'},
{h:'Reading the same row'},
{p:'For `SELECT sal FROM emp WHERE id = 5;` the backend only looks at the buffer cache and, on a miss, the disk. It uses the transaction snapshot to decide which row version is visible, so it never needs to wait for the writer.'},
{h:'Takeaway'},
{p:'Commit speed depends on the **WAL flush**, not on writing the data file, and cleanup happens afterwards. This one path explains tuning topics later in the course: `synchronous_commit`, checkpoint settings and autovacuum.'}]);

A('pg:3:6',[
{h:'What a cluster is'},
{p:'In PostgreSQL a **database cluster** is the collection of databases managed by one server instance and stored in one directory, `PGDATA`. "Cluster" here does not mean several servers. `initdb` creates the directory, the template databases (`template0`, `template1`) and the default `postgres` database.'},
{h:'How a table is stored'},
{p:'Every database is a folder under `base/` named by its **OID** (object ID). Every table and index inside it is a file named by its **relfilenode**, for example `base/5/1259`. A file larger than 1 GB is split into numbered segments (`1259.1`). Alongside the main file there may be a **free space map** (`_fsm`) and **visibility map** (`_vm`) that VACUUM and index-only scans use. Very large column values are moved to a **TOAST** table, so one row can exceed the 8 KB page size.'},
{h:'Practical rules'},
{p:'Never edit or copy files inside a running `PGDATA`; use `pg_basebackup` or `pg_dump`. Put `pg_wal` on fast, separate storage if you can, because it is written constantly. Monitor free space on both the data and WAL volumes, since a full WAL disk stops the database.'}]);
})();
