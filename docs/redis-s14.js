/* LearnSphere - Redis, Section 14: Performance, Monitoring and Troubleshooting.
   Lectures 0-7 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const sources=K.dg(700,220,[
[10,10,680,200,'Where the time goes for one request',1],
[30,70,110,60,'Client',0],[170,70,120,60,'Network|RTT',0],[320,70,130,60,'Queue waiting|behind other work',2],[480,70,100,60,'Execute|command',2],[610,70,60,60,'Reply',0],
[170,150,410,36,'Also: fork pauses, swap, fsync, expiry cycles, big replies',0]],
[[140,100,170,100],[290,100,320,100],[450,100,480,100],[580,100,610,100]]);

const pipeline=K.dg(700,200,[
[10,10,680,180,'Monitoring pipeline',1],
[30,70,130,60,'Redis|INFO',2],[210,70,140,60,'redis_exporter',0],[400,70,120,60,'Prometheus',0],[570,70,100,60,'Grafana|alerts',2]],
[[160,100,210,100],[350,100,400,100],[520,100,570,100]]);

/* ---------- 0 ---------- */
L['redis:13:0']={blocks:[
{p:'`INFO` is the main window into a running server. It is grouped into sections, and you can ask for just one.'},
{code:`INFO
INFO memory
INFO stats
INFO replication
INFO commandstats
INFO keyspace`},
{h:'The numbers to watch'},
{t:[['Area','Metric','Why'],
['Availability','redis_up, uptime_in_seconds','Restarts and outages'],
['Clients','connected_clients, blocked_clients, rejected_connections','Saturation and leaks'],
['Memory','used_memory, mem_fragmentation_ratio, evicted_keys','Capacity, eviction pressure'],
['Cache efficiency','keyspace_hits, keyspace_misses','Hit ratio = hits / (hits + misses)'],
['Throughput','instantaneous_ops_per_sec, total_commands_processed','Load'],
['Errors','total_error_replies, rejected_connections','Failures'],
['Persistence','rdb_last_bgsave_status, aof_last_write_status, latest_fork_usec','Durability health'],
['Replication','master_link_status, lag, sync_full','Copies in step']]},
{h:'Per-command view'},
{p:'`INFO commandstats` shows calls, total time and average time per command. A command with a high total time is a good tuning target.'},
{note:'Numbers matter as trends. Record them and alert on change, rather than inspecting by hand.'}],
src:[['INFO',K.CMD+'info/']]};

/* ---------- 1 ---------- */
L['redis:13:1']={blocks:[
{p:'Redis itself usually answers in microseconds. Latency complaints almost always come from something around it.'},
{svg:sources},
{t:[['Source','Typical sign','Check'],
['Slow commands (KEYS, big SMEMBERS, big sorts)','Spikes tied to specific calls','SLOWLOG, commandstats'],
['Fork for RDB or AOF rewrite','Periodic spike','latest_fork_usec, THP'],
['Swapping','Large, erratic delays','mem_fragmentation_ratio below 1, vmstat'],
['AOF fsync and slow disk','Delays during writes','aof_delayed_fsync, logs'],
['Expiry bursts','Spike when many keys expire together','expired_keys, TTL jitter'],
['Network and queueing','Higher with load','redis-cli --latency, client RTT'],
['Noisy host or virtualisation','Intrinsic latency high','redis-cli --intrinsic-latency']]},
{code:`redis-cli --latency -h redis.example.com
redis-cli --latency-history -i 5
redis-cli --intrinsic-latency 30     # run on the Redis host`},
{note:'Measure latency from the application, not only on the server. A client library, a connection pool or DNS can dominate what users see.'}],
src:[['Latency',K.MGT+'optimization/latency/']]};

/* ---------- 2 ---------- */
L['redis:13:2']={blocks:[
{p:'Two built-in tools find slow work.'},
{h:'SLOWLOG'},
{p:'The slow log records commands that took longer than a threshold, **measured by execution time inside Redis** (not network or queueing).'},
{code:`CONFIG SET slowlog-log-slower-than 10000     # microseconds
CONFIG SET slowlog-max-len 256
SLOWLOG GET 10
SLOWLOG LEN
SLOWLOG RESET`},
{p:'Each entry has an id, a timestamp, the duration in microseconds, the command with arguments, and the client address and name.'},
{h:'Latency monitor'},
{code:`CONFIG SET latency-monitor-threshold 100      # milliseconds
LATENCY LATEST
LATENCY HISTORY command
LATENCY DOCTOR
LATENCY GRAPH command`},
{p:'It records events that exceed the threshold, such as `fork`, `fast-command`, `command`, `aof-fsync-always` and `expire-cycle`, with a time series per event, so you can tie spikes to causes.'},
{note:'Name your clients (`CLIENT SETNAME`) so the slow log shows which application sent the command.'}],
src:[['SLOWLOG',K.CMD+'slowlog/'],['Latency monitor',K.MGT+'optimization/latency-monitor/']]};

/* ---------- 3 ---------- */
L['redis:13:3']={blocks:[
{p:'`redis-benchmark` generates load against a server and reports throughput and latency percentiles.'},
{code:`redis-benchmark -h 10.0.0.10 -p 6379 -c 50 -n 200000 -d 256 -t set,get -q
redis-benchmark -P 16 -t set,get -n 1000000 -r 100000
redis-benchmark --threads 4 -c 200 -n 1000000
redis-benchmark -t set -n 100000 -d 1024 --csv`},
{t:[['Option','Meaning'],
['-c','Parallel connections'],
['-n','Total requests'],
['-d','Value size in bytes'],
['-P','Pipeline depth'],
['-r','Random key space, to avoid hitting one key'],
['-t','Test commands'],
['--threads','Benchmark threads'],
['--cluster','Benchmark a cluster']]},
{h:'Making a benchmark meaningful'},
{ul:['Use value sizes and commands close to your workload.','Run the benchmark from separate hosts that are not the bottleneck.','Test with and without pipelining. Report latency percentiles, not only the average.','Use realistic persistence and replication settings.','Compare under the same conditions after a change.']},
{note:'Numbers from `redis-benchmark` on a laptop say little about production. Use them for relative comparison of settings and hardware, and test real application code too.'}],
src:[['Benchmarks',K.D+'operate/oss_and_stack/management/optimization/benchmarks/']]};

/* ---------- 4 ---------- */
L['redis:13:4']={blocks:[
{p:'Redis exposes its own numbers through `INFO`. A common setup exports them to Prometheus and displays them in Grafana.'},
{svg:pipeline},
{t:[['Alert','Condition (example)','Reason'],
['Instance down','redis_up == 0 for 1m','Outage'],
['Memory high','used_memory / maxmemory above 0.85','Eviction or OOM soon'],
['Evictions','Rate of evicted_keys above 0 on a database','Data is being removed'],
['Rejected connections','Rate above 0','maxclients reached'],
['Replication broken','Link down or lag over a threshold','No failover target'],
['Hit ratio drops','Below your baseline','Cache not effective'],
['Persistence failing','Last save or AOF write status not ok','Data at risk'],
['Latency high','Application p99 above SLO','User impact']]},
{h:'Dashboard essentials'},
{ul:['Memory, fragmentation and evictions.','Ops per second, by command, with errors.','Clients and blocked clients.','Replication offset and lag per replica.','Persistence: last save age, fork time.','Slow log count and the top commands by time.']},
{note:'Managed services publish equivalent metrics (for example CloudWatch for ElastiCache). The names differ, the signals do not.'}],
src:[['Observability',K.MGT+'admin/'],['Redis exporter','https://github.com/oliver006/redis_exporter']]};

/* ---------- 5 ---------- */
L['redis:13:5']={blocks:[
{p:'Connections are a resource. Too many, idle ones and slow ones all cause problems.'},
{t:[['Setting','Default','Purpose'],
['maxclients','10000, limited by the file descriptor limit','Maximum connections'],
['timeout','0 (never)','Close idle clients after N seconds'],
['tcp-keepalive','300','Detect dead peers'],
['tcp-backlog','511','Pending connection queue, needs a matching somaxconn'],
['client-output-buffer-limit','normal 0 0 0, replica 256mb 64mb 60, pubsub 32mb 8mb 60','Protect memory from slow readers'],
['client-query-buffer-limit','1gb','Maximum a client can send in a single command']]},
{code:`CLIENT LIST
CLIENT INFO
CLIENT SETNAME billing-api
CLIENT KILL ID 42
CLIENT NO-EVICT on
INFO clients`},
{h:'Typical problems'},
{ul:['**Connection leaks** from clients that never close: rising connected_clients.','**Max clients reached**: `ERR max number of clients reached`. Fix pools, then raise limits and the OS descriptor limit.','**Big output buffers**: look at `omem` in `CLIENT LIST` for the clients that cannot read fast enough.','**Connection storms** after a restart: add jitter and backoff in clients.']},
{note:'Set a pool size per application instance and multiply by the number of instances. That total, plus admin and replica connections, must fit under maxclients.'}],
src:[['Client handling',K.D+'develop/reference/clients/'],['CLIENT LIST',K.CMD+'client-list/']]};

/* ---------- 6 ---------- */
L['redis:13:6']={blocks:[
{p:'Because commands run on one thread, one node has a ceiling. Know the levers before reaching for a cluster.'},
{t:[['Lever','Effect','Trade-off'],
['Pipelining and batching','Fewer round trips, more throughput per connection','Larger bursts'],
['Cheaper commands, smaller values','Less time on the main thread','Data model changes'],
['I/O threads (io-threads)','Parallelise reading and writing sockets, parsing','More CPU, command execution still serial'],
['Local or client-side caching','Fewer requests','Staleness'],
['Read replicas','Spread read load','Lag'],
['Cluster','More primaries, more total throughput','Operations and constraints'],
['Faster CPU','Higher single-thread speed','Cost']]},
{code:`# redis.conf
io-threads 4`},
{h:'About I/O threads'},
{ul:['Enable them when network handling is the bottleneck, typically with many clients and larger payloads.','Use fewer threads than cores. More than about 8 rarely helps.','Only socket work is parallel. A slow command still blocks everything.']},
{note:'Before scaling out, find the real limit: CPU of the main thread (check with `top` per thread), network bandwidth or memory. The fix depends on which one it is.'}],
src:[['Threading',K.MGT+'optimization/latency/'],['Benchmarks',K.D+'operate/oss_and_stack/management/optimization/benchmarks/']]};

/* ---------- 7 ---------- */
L['redis:13:7']={blocks:[
{p:'Start from the symptom, then look at the first check.'},
{t:[['Symptom','Likely cause','First check'],
['Writes fail with OOM','maxmemory reached with noeviction','INFO memory, policy, big keys'],
['Latency spikes at regular intervals','Fork, expiry burst, scheduled slow job','LATENCY DOCTOR, latest_fork_usec'],
['High CPU on one core','Slow commands or too much traffic','SLOWLOG, commandstats'],
['Clients time out','Blocked server, saturated network, small timeouts','--latency, SLOWLOG, CLIENT LIST'],
['ERR max number of clients','Leak or pool too large','INFO clients'],
['Replica lagging','Slow link, big writes, replica busy','INFO replication'],
['Keys disappearing','TTL, eviction, flush','evicted_keys, expired_keys, ACL LOG'],
['MISCONF error','Failed background save','Disk, permissions, logs'],
['Low hit ratio','Poor key design, small cache, TTL too short','keyspace_hits, misses, evictions'],
['Cluster state fail','Uncovered slots, nodes down','CLUSTER INFO, --cluster check'],
['Unexpected data after restart','No persistence, wrong restore','CONFIG GET appendonly save']]},
{h:'Method'},
{flow:['Define the symptom and when it started','Check INFO and the monitoring dashboard for what changed','Check SLOWLOG, LATENCY and CLIENT LIST for the cause','Test a fix on a replica or staging first','Record what happened and add an alert so it is seen sooner']},
{note:'Avoid `MONITOR`, `KEYS *` and `DEBUG` on a production node while it is struggling. They add load to the problem.'}],
src:[['Diagnosing latency',K.MGT+'optimization/latency/'],['Admin',K.MGT+'admin/']]};
})();
