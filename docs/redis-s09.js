/* LearnSphere - Redis, Section 09: Persistence and Durability.
   Lectures 0-6 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const options=K.dg(700,210,[
[10,10,680,190,'What survives a restart',1],
[30,60,150,70,'No persistence|cache only,|everything lost',0],[200,60,150,70,'RDB only|periodic snapshots,|minutes of loss',0],[370,60,150,70,'AOF|log of writes,|about 1 second of loss',0],[540,60,130,70,'RDB and AOF|recommended for|durable data',2]],
[]);

const rdb=K.dg(700,210,[
[10,10,680,190,'BGSAVE with fork and copy-on-write',1],
[30,70,140,60,'Parent keeps|serving clients',2],[260,40,160,50,'fork()',0],[260,120,160,50,'Child writes|temp-PID.rdb',0],[500,120,170,50,'Rename to|dump.rdb',0]],
[[170,100,260,65],[340,90,340,120],[420,145,500,145]]);

const aof=K.dg(700,210,[
[10,10,680,190,'Append-only file',1],
[30,70,130,60,'Write command|applied in memory',0],[210,70,130,60,'Appended to|AOF buffer',0],[390,70,130,60,'write() to file|then fsync policy',2],[570,70,100,60,'Replayed|on start',0]],
[[160,100,210,100],[340,100,390,100],[520,100,570,100]]);

const multi=K.dg(700,190,[
[10,10,680,170,'Redis 7+ multi-part AOF in appendonlydir',1],
[30,60,180,60,'appendonly.aof.1.base.rdb|base snapshot',0],[250,60,200,60,'appendonly.aof.1.incr.aof|new writes',2],[490,60,180,60,'appendonly.aof.manifest|lists the files',0]],
[]);

/* ---------- 0 ---------- */
L['redis:8:0']={blocks:[
{p:'Memory is volatile. Persistence writes data to disk so a restart does not start empty. The right choice depends on what the data is and how much loss you can accept.'},
{svg:options},
{t:[['Mode','How','Loss window','Cost'],
['None','Nothing on disk','Everything','Lowest'],
['RDB','Point-in-time snapshots','Since the last snapshot, minutes','Fork periodically'],
['AOF','Log every write','About one second with everysec, none-ish with always','Disk writes, larger files'],
['RDB and AOF','Both','As AOF','Highest']]},
{h:'Questions to ask'},
{ul:['Can the data be rebuilt from another system? Then persistence may be unnecessary.','What is the recovery time objective? RDB loads fastest.','What is the recovery point objective? AOF gives the tightest bound.','Is there a replica? Replication is not a backup, but it changes the risk.']},
{note:'Persistence protects against **a restart** of one node. It does not protect from deletion mistakes, corruption replicated to replicas or loss of the host. Plan separate off-host backups.'}],
src:[['Persistence',K.MGT+'persistence/']]};

/* ---------- 1 ---------- */
L['redis:8:1']={blocks:[
{p:'An **RDB** file is a compact, point-in-time snapshot of the dataset. Redis creates it by forking: the child process writes the file while the parent continues to serve clients, sharing memory through copy-on-write.'},
{svg:rdb},
{code:`# redis.conf
save 3600 1 300 100 60 10000
dbfilename dump.rdb
dir /var/lib/redis
rdbcompression yes

BGSAVE
LASTSAVE
INFO persistence`},
{t:[['Setting or command','Meaning'],
['save S N','Snapshot if at least N changes in S seconds'],
['SAVE','Snapshot in the main thread. Blocks clients, avoid it'],
['BGSAVE','Snapshot in a child process'],
['stop-writes-on-bgsave-error','Refuse writes if the last snapshot failed (default yes)'],
['rdbchecksum','Add a checksum to detect corruption']]},
{h:'Properties'},
{ul:['Compact and fast to load, ideal for backups and replica bootstrap.','You lose changes since the last snapshot.','The fork can pause the server for milliseconds to seconds on a large dataset, see `latest_fork_usec`.','The file is written to a temporary name and renamed, so a crash does not leave a half-written `dump.rdb`.']}],
src:[['RDB',K.MGT+'persistence/#snapshotting'],['BGSAVE',K.CMD+'bgsave/']]};

/* ---------- 2 ---------- */
L['redis:8:2']={blocks:[
{p:'The **append-only file (AOF)** records every write command. On start, Redis replays the log to rebuild the dataset.'},
{svg:aof},
{code:`# redis.conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb`},
{h:'fsync policy'},
{t:[['appendfsync','Behaviour','Loss on crash','Performance'],
['always','fsync after every write','Almost none','Slowest'],
['everysec (default)','fsync once per second in the background','About one second','Good'],
['no','Leave flushing to the operating system','Up to tens of seconds','Fastest']]},
{h:'Rewrite'},
{p:'The log grows without bound, so Redis periodically **rewrites** it into the smallest set of commands that rebuilds the current dataset. The rewrite runs in a child process, similar to BGSAVE, and is triggered by size growth or by `BGREWRITEAOF`.'},
{note:'`everysec` can lose about one second, and more if the disk is slow and a write is delayed. Redis keeps serving reads and writes during that time.'}],
src:[['AOF',K.MGT+'persistence/#append-only-file'],['BGREWRITEAOF',K.CMD+'bgrewriteaof/']]};

/* ---------- 3 ---------- */
L['redis:8:3']={blocks:[
{p:'Redis 7.0 changed the AOF into a **multi-part** layout. Instead of one file that is rewritten, the AOF is a directory of files described by a manifest.'},
{svg:multi},
{t:[['File','Purpose'],
['appendonly.aof.N.base.rdb (or .aof)','Base snapshot produced by the last rewrite. Uses RDB format by default'],
['appendonly.aof.N.incr.aof','Incremental commands written after the base'],
['appendonly.aof.manifest','Lists base and incremental files in order']]},
{h:'What this changes'},
{ul:['`aof-use-rdb-preamble yes` (default) makes the base an RDB file, so loading is fast.','During a rewrite, a new incremental file starts. There is no large rewrite buffer in memory.','The directory is `appenddirname`, `appendonlydir` by default.','Backups must copy the **whole directory**, not a single file.']},
{h:'Recovery'},
{code:`redis-check-aof appendonlydir/appendonly.aof.manifest
redis-check-aof --fix appendonlydir/appendonly.aof.1.incr.aof`},
{note:'`aof-load-truncated yes` lets Redis start when the end of the last file is cut by a crash. Anything else damaged needs `redis-check-aof --fix`, which can drop data after the fault.'}],
src:[['Multi-part AOF',K.MGT+'persistence/'],['redis-check-aof',K.MGT+'persistence/#what-should-i-do-if-my-aof-gets-corrupted']]};

/* ---------- 4 ---------- */
L['redis:8:4']={blocks:[
{p:'Choose by workload, then verify with a restart test.'},
{t:[['Use case','Suggested persistence','Why'],
['Pure cache, data rebuildable','None, or occasional RDB','Fast restarts matter less than speed'],
['Cache with expensive warm-up','RDB','Quick warm restart after a deploy'],
['Session store','AOF everysec','Small loss window'],
['Queues and streams of work','AOF everysec, replicas','Avoid losing accepted jobs'],
['Primary data store','AOF and RDB, replicas, off-host backups','Durability and fast recovery'],
['Replica that is only a backup','RDB on the replica','Offload persistence from the primary']]},
{h:'Combining RDB and AOF'},
{p:'With both enabled, Redis loads the **AOF** at startup because it is more complete. RDB snapshots remain useful as compact backups and for replicas.'},
{h:'Persistence on replicas'},
{p:'Turning persistence **off** on the primary and **on** on a replica reduces primary latency. It is risky: if the primary restarts empty and a replica then replicates from it, the replica data is wiped. Avoid unless automatic restart is disabled or controlled.'},
{note:'Replication is not durability. A primary that restarts empty and reconnects can propagate that empty state to replicas.'}],
src:[['Persistence',K.MGT+'persistence/']]};

/* ---------- 5 ---------- */
L['redis:8:5']={blocks:[
{p:'A backup you have never restored is a hope, not a backup. Know both procedures.'},
{h:'Taking a backup'},
{flow:['Trigger a snapshot with BGSAVE and wait until rdb_bgsave_in_progress is 0','Copy dump.rdb (the file is written atomically)','For AOF, copy the whole appendonlydir, ideally while rewrites are not running','Ship the copy off the host and encrypt it','Record the Redis version and configuration with it']},
{code:`redis-cli BGSAVE
redis-cli INFO persistence | grep rdb_bgsave_in_progress
redis-cli --rdb /backup/dump.rdb          # pull a snapshot over the network`},
{h:'Restoring'},
{flow:['Stop the server','Place dump.rdb in the data directory','Start with appendonly no, so Redis loads the RDB','Check the data','Enable AOF: CONFIG SET appendonly yes, then CONFIG REWRITE']},
{note:'If `appendonly yes` is configured at start, Redis loads the AOF and **ignores the RDB**, which often means an empty dataset after a restore. Start without AOF, then enable it once the data is loaded.'},
{h:'Test regularly'},
{p:'Restore into a scratch instance on a schedule, run `DBSIZE` and a few spot checks, and measure the time it takes. That time is your real recovery time.'}],
src:[['Backing up',K.MGT+'persistence/#backing-up-redis-data']]};

/* ---------- 6 ---------- */
L['redis:8:6']={blocks:[
{p:'Most persistence incidents show up as latency, errors on writes or a refusal to start.'},
{t:[['Symptom','Likely cause','What to do'],
['Latency spike every few minutes','Fork pause for BGSAVE or rewrite','Check latest_fork_usec, disable THP, reduce dataset per node'],
['Error MISCONF on writes','Snapshot failed, disk full or permission','Fix the disk or path, run BGSAVE, check stop-writes-on-bgsave-error'],
['Log: AOF fsync taking too long','Slow disk or contention','Faster disk, move other IO away, review appendfsync'],
['Will not start after crash','Truncated or corrupt AOF','redis-check-aof --fix, restore from backup'],
['RDB will not load','Corrupt file or version mismatch','redis-check-rdb, restore a previous backup'],
['Memory spikes at snapshot','Copy-on-write under heavy writes','More headroom, schedule snapshots at a quiet time'],
['Persistence disabled by mistake','appendonly no and no save points','Check CONFIG GET save appendonly']]},
{code:`INFO persistence
redis-check-rdb dump.rdb
redis-check-aof --fix appendonlydir/appendonly.aof.1.incr.aof
LATENCY DOCTOR`},
{note:'Always copy the damaged file before running a repair tool. `--fix` truncates the file at the fault and can remove later commands.'}],
src:[['Persistence troubleshooting',K.MGT+'persistence/'],['Latency',K.MGT+'optimization/latency/']]};
})();
