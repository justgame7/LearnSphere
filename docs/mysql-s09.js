/* LearnSphere - MySQL, Section 09: InnoDB Storage Engine.
   Lectures 0-6 are core. Needs mysql-common.js. Defaults are for MySQL 8.4 unless stated. */
(function(){
const K=window.MY,L=window.LESSONS;

const arch=K.dg(700,330,[
[10,10,680,310,'InnoDB: memory (top) and disk (bottom)',1],
[25,40,330,110,'Buffer pool|cached data and index pages|change buffer pages, undo pages|adaptive hash index (optional)',2],[375,40,300,110,'Log buffer|redo records before flush|written to disk on commit',0],
[25,185,150,50,'Doublewrite files|#ib_*.dblwr',0],[190,185,165,50,'Tablespaces|.ibd files, mysql.ibd',0],[375,185,140,50,'Redo log|#innodb_redo',0],[530,185,145,50,'Undo tablespaces|undo_001, undo_002',0],
[25,260,650,40,'Background threads: page cleaner, purge, log writer, I/O threads',0]],
[[100,150,100,185],[272,150,272,185],[445,150,445,185]]);

const lru=K.dg(700,190,[
[10,10,680,170,'Buffer pool LRU list with a midpoint',1],
[25,60,300,60,'Young sublist (5/8)|hot pages stay here',2],[345,60,330,60,'Old sublist (3/8)|new pages enter at the midpoint',0],
[25,130,650,30,'A page read once by a scan is evicted from the old end without displacing hot pages',0]],
[[325,90,345,90]]);

const crash=K.dg(700,170,[
[10,10,680,150,'Write-ahead logging',1],
[20,60,130,50,'Change page|in buffer pool|(dirty)',0],[170,60,130,50,'Write redo|record to log|buffer',2],[320,60,130,50,'Commit: flush|redo to disk',2],[470,60,130,50,'Later: flush|dirty page|to data file',0]],
[[150,85,170,85],[300,85,320,85],[450,85,470,85]]);

const pages=K.dg(700,190,[
[10,10,680,170,'Inside a 16 KB page',1],
[25,50,120,50,'Page header|and trailer',0],[160,50,320,50,'Rows in primary key order (linked list)|records with next-record pointers',2],[495,50,180,50,'Page directory|slots for binary search',0],
[25,120,650,40,'A table is a B-tree of pages. Leaf pages of the clustered index hold the full rows.',0]],[]);

/* ---------- 0 ---------- */
L['mysql:8:0']={blocks:[
{p:'A **storage engine** stores, retrieves and protects the data of tables. The SQL layer talks to engines through a common interface, so different tables can use different engines. Today almost all production tables use **InnoDB**.'},
{t:[['Engine','Transactions','Row locks','Foreign keys','Crash safe','Use today'],
['InnoDB','Yes','Yes','Yes','Yes','Default for everything'],
['MyISAM','No','Table locks only','No','No','Legacy. Avoid. The system tables use InnoDB since 8.0'],
['MEMORY','No','Table locks','No','Data lost on restart','Temporary lookup data only'],
['CSV','No','No','No','Not applicable','Exchanging simple files'],
['ARCHIVE','No','Insert only','No','Limited','Compressed append-only logs, rare'],
['NDB','Yes','Yes','Yes','Yes','MySQL Cluster, a different product']]},
{code:`SHOW ENGINES;
SELECT table_name, engine FROM information_schema.tables WHERE table_schema = 'shop';
CREATE TABLE t (id INT PRIMARY KEY) ENGINE=InnoDB;
SELECT @@default_storage_engine;`},
{h:'Why InnoDB is the default'},
{ul:['**ACID transactions** with commit, rollback and crash recovery.','**Row-level locking** and MVCC: readers do not block writers.','**Foreign keys** and constraint support.','**Clustered primary key** gives fast primary key lookups and range scans.','The engine behind Group Replication and InnoDB Cluster, which require InnoDB.']},
{h:'Why not MyISAM'},
{ul:['No transactions: a crash can leave partial changes and corrupt tables that need a repair.','Table-level locks: a write blocks all readers and other writers.','No foreign keys and no crash recovery.','Backups of a running MyISAM table are harder to make consistent.']},
{note:'If you inherit MyISAM tables, convert them with `ALTER TABLE t ENGINE=InnoDB` after checking for features MyISAM had that InnoDB handles differently, such as stored `COUNT(*)` (InnoDB must count) and full-text (supported in InnoDB since 5.6).'}],
src:[['Storage engines',K.D+'storage-engines.html'],['Alternative storage engines',K.D+'storage-engines.html']]};

/* ---------- 1 ---------- */
L['mysql:8:1']={blocks:[
{p:'InnoDB follows a simple idea: work on data in **memory**, protect it with **logs**, and write it to data files **lazily**. The map below shows the pieces. The next lessons take them one at a time.'},
{svg:arch},
{h:'The components'},
{t:[['Component','Where','Job'],
['Buffer pool','Memory','Caches data and index pages. Most reads and writes happen here'],
['Log buffer','Memory','Holds redo records until they are flushed'],
['Redo log','Disk','Records changes so committed work survives a crash'],
['Undo logs','Disk, in undo tablespaces','Old row versions for rollback and consistent reads'],
['Doublewrite buffer','Disk','Protects against half-written pages'],
['Change buffer','Memory and disk','Delays secondary index changes for pages not in memory'],
['Tablespaces','Disk','Files holding table and index pages'],
['Background threads','Memory','Flush dirty pages, purge old versions, handle I/O']]},
{h:'What happens on an UPDATE'},
{flow:['InnoDB finds the row page, reading it into the buffer pool if needed','It locks the row and writes the old version to the undo log','It changes the page in memory, which is now a dirty page','It writes a redo record to the log buffer','At commit the redo log is flushed to disk, making the change durable','The dirty page is written to its data file later by background threads','Purge removes undo history once no transaction needs it']},
{p:'The key insight: the **data file does not have to be up to date at commit time**. Only the small, sequential redo log must reach disk. After a crash InnoDB replays the redo log to bring data files up to date.'},
{h:'Where to look'},
{code:`SHOW ENGINE INNODB STATUS\\G
SELECT * FROM information_schema.innodb_metrics WHERE status = 'enabled' LIMIT 10;
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool%';`}],
src:[['InnoDB architecture',K.D+'innodb-architecture.html'],['InnoDB in-memory structures',K.D+'innodb-in-memory-structures.html']]};

/* ---------- 2 ---------- */
L['mysql:8:2']={blocks:[
{p:'The **buffer pool** is InnoDB main memory cache. It holds pages of tables and indexes, so repeated reads avoid the disk. It is the **most important memory setting** on a database server.'},
{h:'Sizing'},
{ul:['`innodb_buffer_pool_size` sets the size. Default is 128 MB, far too small for real servers.','On a server dedicated to MySQL, 50 to 75 percent of RAM is a common starting point. Leave room for connection buffers, the operating system and other processes.','It can be resized online: `SET GLOBAL innodb_buffer_pool_size = 8*1024*1024*1024;`. The pool is resized in chunks (`innodb_buffer_pool_chunk_size`).','`innodb_buffer_pool_instances` splits the pool into parts to reduce contention on large servers.']},
{p:'The goal is that the **working set**, the data that is actually used, fits in memory. If it does not, reads go to disk and latency grows.'},
{h:'How pages are managed'},
{svg:lru},
{p:'The pool uses a Least Recently Used list split at a midpoint. A new page enters at the **midpoint**, and moves to the young end only if read again after `innodb_old_blocks_time` (1 second). That protects hot pages from being pushed out by one large table scan.'},
{h:'Dirty pages and flushing'},
{p:'Changed pages stay in the pool as dirty pages until background **page cleaner** threads write them to disk. Flushing speed depends on `innodb_io_capacity` (how many I/O operations per second the storage can handle) and on how much redo log space remains. Too little redo capacity or too low I/O capacity forces aggressive flushing and visible stalls.'},
{h:'Warm-up'},
{p:'After a restart the pool is empty and queries are slow until it fills. MySQL can save the list of pages at shutdown and reload them at startup: `innodb_buffer_pool_dump_at_shutdown` and `innodb_buffer_pool_load_at_startup` are both ON by default.'},
{h:'Health indicators'},
{code:`SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- Innodb_buffer_pool_reads          = reads that went to disk
-- Innodb_buffer_pool_read_requests  = logical reads
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_pages%';     -- total, free, dirty, data
SELECT @@innodb_buffer_pool_size / 1024 / 1024 AS mb;`},
{p:'A rough hit ratio is `1 - reads / read_requests`. A high ratio is good, but the absolute number of disk reads and the latency users see matter more than a percentage.'},
{note:'Do not make the buffer pool so big that the host starts swapping. Swapping a database is far worse than a smaller cache.'}],
src:[['Buffer pool',K.D+'innodb-buffer-pool.html'],['Configuring buffer pool size',K.D+'innodb-buffer-pool-resize.html']]};

/* ---------- 3 ---------- */
L['mysql:8:3']={blocks:[
{p:'Two logs make InnoDB **durable** and **transactional**. The **redo log** replays committed work after a crash. The **undo log** reverses uncommitted work and keeps old row versions for readers.'},
{svg:crash},
{h:'Redo log'},
{ul:['Records physical changes to pages in a **circular** set of files in the `#innodb_redo` directory.','**Write-ahead**: the redo record must be on disk before a commit is acknowledged. Writing it is sequential and cheap, unlike random page writes.','Size is set with `innodb_redo_log_capacity` (MySQL 8.0.30 and later), changeable online. The older `innodb_log_file_size` is deprecated.','If the log fills, InnoDB must flush dirty pages to make space, and writes stall. Size it so that it covers a few minutes to an hour of write activity.']},
{h:'Durability setting'},
{t:[['innodb_flush_log_at_trx_commit','Behaviour at commit','Risk if the OS or host crashes'],
['1 (default)','Write and flush redo to disk','None. Fully durable'],
['2','Write to the OS cache, flush once per second','Up to about 1 second of commits lost. A mysqld crash alone loses nothing'],
['0','Write and flush about once per second','Up to about 1 second of commits lost, even on a mysqld crash']]},
{p:'Use `1` for data you cannot lose. Pair it with `sync_binlog = 1` (the default) so the binary log is also flushed per commit. Relaxing these trades safety for speed, and should be a conscious decision.'},
{h:'Undo log'},
{ul:['Before a row changes, the old version is saved in the **undo log**, which lives in undo tablespaces (`undo_001`, `undo_002`).','On **rollback**, undo restores the old values.','For **consistent reads**, other transactions can read the old version they are entitled to see (MVCC).','A **purge** process removes undo records once no active transaction needs them. A long-running transaction stops purge and makes the history grow (**history list length**).']},
{code:`SELECT name, count FROM information_schema.innodb_metrics WHERE name = 'trx_rseg_history_len';
SHOW ENGINE INNODB STATUS\\G      -- see History list length in the TRANSACTIONS section`},
{h:'Crash recovery'},
{flow:['mysqld starts and finds that the last shutdown was not clean','InnoDB reads the redo log from the last checkpoint and reapplies changes to pages (roll forward)','Transactions that were active at the crash and never committed are found','Their changes are reversed with the undo log (roll back)','The server opens for connections, and the work of rolling back large transactions may continue in the background']},
{note:'Recovery time depends on how much redo has to be applied and how large the open transactions were. A huge uncommitted transaction can make a restart slow.'}],
src:[['Redo log',K.D+'innodb-redo-log.html'],['Undo logs',K.D+'innodb-undo-logs.html'],['InnoDB recovery',K.D+'innodb-recovery.html']]};

/* ---------- 4 ---------- */
L['mysql:8:4']={blocks:[
{h:'Doublewrite buffer'},
{p:'An InnoDB page is 16 KB, but the operating system and disk may write only 4 KB at a time. If power fails mid-write, a page can be **torn**: half old, half new. Redo records describe changes to a consistent page, so they cannot repair a torn one.'},
{p:'Before writing dirty pages to their final location, InnoDB first writes them to the **doublewrite** area in a sequential batch. After a crash, if a data page is torn, the intact copy from the doublewrite area is used to repair it, and then redo is applied.'},
{ul:['Controlled by `innodb_doublewrite` (ON by default). In 8.0.20 and later the doublewrite storage is separate files named `#ib_*.dblwr` in the data directory, not inside the system tablespace.','Switching it off improves write throughput slightly but is only safe when the storage guarantees atomic 16 KB writes. Leave it on unless you know your storage does.']},
{h:'Change buffer'},
{p:'Changes to **non-unique secondary indexes** require reading the index page. When that page is not in memory, InnoDB can **buffer the change** instead of reading the page from disk. The buffered changes are merged later when the page is read for another reason, or by a background process.'},
{ul:['It helps write-heavy workloads on big tables whose secondary indexes do not fit in memory, especially on spinning disks.','It does not apply to unique indexes (the uniqueness check needs the page) or to the clustered index.','`innodb_change_buffering` selects which operations are buffered. In MySQL 8.4 the default is **none**, because fast SSDs reduce the benefit and the feature has a maintenance cost. Check the default for your version, and enable it only if you measure a gain.']},
{h:'Adaptive hash index'},
{p:'InnoDB can build an in-memory **hash index** on top of B-tree pages that are accessed repeatedly with equality lookups. This makes some lookups faster.'},
{ul:['Controlled by `innodb_adaptive_hash_index`. In MySQL 8.4 the default is **OFF**. Earlier versions defaulted to ON.','It can become a point of contention on busy servers with many concurrent queries, which is why the default changed.','Turn it on only if tests show a gain for your workload.']},
{h:'Comparing the three'},
{t:[['Feature','Purpose','Risk or cost'],
['Doublewrite buffer','Repair torn pages after a crash','Extra writes'],
['Change buffer','Defer secondary index maintenance','Can delay and then burst work. Memory use'],
['Adaptive hash index','Faster repeated equality lookups','Contention on busy systems']]},
{note:'Defaults changed in 8.4 for the change buffer and the adaptive hash index. If you upgrade from 8.0 and a workload changes behaviour, compare these settings first.'}],
src:[['Doublewrite buffer',K.D+'innodb-doublewrite-buffer.html'],['Change buffer',K.D+'innodb-change-buffer.html'],['Adaptive hash index',K.D+'innodb-adaptive-hash.html']]};

/* ---------- 5 ---------- */
L['mysql:8:5']={blocks:[
{p:'InnoDB stores data in **tablespaces**, which are files made of fixed-size **pages**. Rows live inside pages, and the way a row is laid out is its **row format**.'},
{svg:pages},
{h:'Page size'},
{p:'The default page size is **16 KB** (`innodb_page_size`, set when the instance is created and not changeable later). Each page holds many rows and belongs to one B-tree. Pages are grouped into **extents** of 1 MB for allocation.'},
{h:'Tablespace types'},
{t:[['Tablespace','File','Contents'],
['File-per-table','`schema/table.ibd`','One table and its indexes. Default (`innodb_file_per_table = ON`)'],
['System','`ibdata1`','Change buffer, undo (legacy) and a few internal items. Data dictionary moved to `mysql.ibd` in 8.0'],
['Data dictionary','`mysql.ibd`','Metadata about all objects'],
['General','Named file you create','Several tables share one file. Can be placed on a chosen path'],
['Undo','`undo_001`, `undo_002`','Undo logs. Can be added, and truncated automatically'],
['Temporary','`#innodb_temp`, `ibtmp1`','Session and global temporary data']]},
{code:`SELECT space, name, row_format, space_type FROM information_schema.innodb_tablespaces LIMIT 10;
CREATE TABLESPACE ts_fast ADD DATAFILE 'ts_fast.ibd' ENGINE=InnoDB;
CREATE TABLE hot (id INT PRIMARY KEY) TABLESPACE ts_fast;
SHOW VARIABLES LIKE 'innodb_file_per_table';`},
{p:'**File-per-table** is the best default: dropping or truncating a table returns the space to the operating system, tables can be moved or backed up individually and `OPTIMIZE TABLE` can shrink them.'},
{h:'Row formats'},
{t:[['Row format','Notes'],
['DYNAMIC (default)','Long values (large VARCHAR, TEXT, BLOB) are stored **off page**, leaving only a 20-byte pointer in the row. Supports large index prefixes of up to 3072 bytes'],
['COMPACT','Older default. Stores a prefix of long values on the page'],
['REDUNDANT','Oldest format. Kept for compatibility'],
['COMPRESSED','Compresses pages with zlib. Slower CPU use. Transparent page compression with sparse files is an alternative']]},
{code:`CREATE TABLE logs (id BIGINT PRIMARY KEY, msg TEXT) ROW_FORMAT=DYNAMIC;
SELECT table_name, row_format FROM information_schema.tables WHERE table_schema = 'shop';`},
{h:'What this means in practice'},
{ul:['A row has to fit in about **half a page** (8 KB) for the in-page part. Larger values go off-page.','Wide rows mean fewer rows per page, so more I/O for scans and a lower buffer pool hit rate. Keep hot tables narrow.','Random inserts into the middle of the primary key cause **page splits** and fragmentation. A sequential key avoids it.','Deleting rows leaves free space inside the pages. `OPTIMIZE TABLE` rebuilds the table to reclaim it.']},
{note:'Compression and data at rest encryption are options set per table or tablespace. They are covered in the security and operations sections.'}],
src:[['InnoDB tablespaces',K.D+'innodb-tablespace.html'],['Row formats',K.D+'innodb-row-format.html'],['Page size',K.D+'innodb-physical-structure.html']]};

/* ---------- 6 ---------- */
L['mysql:8:6']={blocks:[
{p:'Knowing what lives in the **data directory** (`datadir`) helps with backups, disk usage, incidents and security. Find it with `SELECT @@datadir;`.'},
{t:[['Path or file','What it is','Notes'],
['`mysql.ibd`','Data dictionary tablespace','All object metadata. Never edit'],
['`ibdata1`','System tablespace','Change buffer and internal data. Does not shrink'],
['`#innodb_redo/`','Redo log files','About 32 files in a circular set'],
['`undo_001`, `undo_002`','Undo tablespaces','Can be truncated automatically'],
['`#ib_16384_0.dblwr`','Doublewrite files','Used for torn page repair'],
['`#innodb_temp/`','Temporary tablespaces','Session temporary data'],
['`ib_buffer_pool`','Saved buffer pool page list','Used to warm up after restart'],
['`schema_name/`','One directory per database','Holds `.ibd` files for tables'],
['`schema/table.ibd`','File-per-table tablespace','Data and indexes of a table'],
['`binlog.000001`, `binlog.index`','Binary log files and their index','For replication and recovery. Prefix set by `log_bin_basename`'],
['`relay-bin.*`, `*.relay_log_info`','Relay logs on replicas',''],
['`auto.cnf`','Holds `server_uuid`','Identity of the server. A copied data directory needs a new one'],
['`mysqld-auto.cnf`','Persisted variables from SET PERSIST',''],
['`ca.pem`, `server-cert.pem`, `server-key.pem`','Auto-generated TLS certificates','Used unless you configure your own'],
['`mysql`, `sys`, `performance_schema`','System schemas','Accounts, helper views and instrumentation'],
['`hostname.err`','Error log (default location)','First place to look for problems']]},
{h:'Rules of thumb'},
{ul:['**Never edit or delete** files in the data directory of a running server. Remove tables with SQL.','Put the data directory on fast, reliable storage with enough free space. A full disk stops writes and can corrupt the server state.','Keep **redo and binary logs on durable storage**. Separate volumes for data, logs and temporary files help with I/O isolation.','Copying the data directory is a valid **physical backup** only when the server is stopped or when using a tool that guarantees consistency.','Permissions: owned by the `mysql` user, mode 750, so that others cannot read data files.']},
{h:'Checking disk use'},
{code:`SELECT table_schema,
       ROUND(SUM(data_length + index_length) / 1024 / 1024) AS size_mb
FROM information_schema.tables
GROUP BY table_schema ORDER BY size_mb DESC;

SELECT table_name, ROUND(data_length/1024/1024) AS data_mb, ROUND(index_length/1024/1024) AS index_mb,
       ROUND(data_free/1024/1024) AS free_mb
FROM information_schema.tables WHERE table_schema = 'shop' ORDER BY data_length DESC;`},
{note:'`ibdata1` never shrinks. If you inherit a server with a huge one from the old days, the fix is a logical dump and restore into file-per-table tablespaces.'}],
src:[['The MySQL data directory',K.D+'data-directory.html'],['InnoDB on-disk structures',K.D+'innodb-on-disk-structures.html']]};
})();
