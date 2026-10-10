/* LearnSphere - Performance, Section 09: Storage, I/O & OS-Level Performance.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const PT=O.D+'tgdba/';

/* ---------- diagrams ---------- */
const io=O.dg(700,170,[
[10,45,140,80,'IOPS|operations|per second',2],
[200,45,140,80,'Throughput|MB per second',2],
[390,45,140,80,'Latency|ms per request',2],
[580,25,110,120,'OLTP: IOPS and|latency matter.|DW: throughput.',0]],
[[530,85,580,85]]);

const stack=O.dg(700,200,[
[10,20,160,160,'Oracle',1],[25,60,130,40,'DBWR, LGWR, FG',0],[25,115,130,40,'Async I/O',0],
[230,20,160,160,'OS',1],[245,60,130,40,'Filesystem or ASM',0],[245,115,130,40,'Multipath, queue',0],
[450,20,240,160,'Storage',1],[465,60,210,40,'HBA, network, switches',0],[465,115,210,40,'Array: cache, disks, flash',0]],
[[170,100,230,100],[390,100,450,100]]);

/* ---------- 0: IOPS, throughput, latency ---------- */
L['ora-perf:8:0']={blocks:[
{p:'Three numbers describe storage. A system can be good at one and weak at another.'},
{svg:io},
{t:[['Metric','Meaning','Matters for'],
['**IOPS**','Read or write operations per second','OLTP: many small random I/Os'],
['**Throughput**','Megabytes per second','Warehouses, backups, scans'],
['**Latency**','Time for one I/O (milliseconds)','Commit time, index lookups']]},
{h:'Rules of thumb (verify on your system)'},
{t:[['I/O type','Healthy'],
['Single-block read (`db file sequential read`)','Below 5 ms on flash, about 10 ms on spinning disk'],
['Redo write (`log file parallel write`)','Below 2 to 5 ms'],
['Multiblock read','Throughput near hardware limit']]},
{note:'Average latency hides spikes. Use a histogram (`V$EVENT_HISTOGRAM`) to see how many I/Os were very slow.'}],
src:[['I/O configuration',PT]]};

/* ---------- 1: Calibrate IO ---------- */
L['ora-perf:8:1']={blocks:[
{p:'Measure what Oracle sees, from inside the database.'},
{code:`-- built-in calibration (database must be quiet, ASYNC I/O on)
SET SERVEROUTPUT ON
DECLARE l_iops PLS_INTEGER; l_mbps PLS_INTEGER; l_lat PLS_INTEGER;
BEGIN
  DBMS_RESOURCE_MANAGER.CALIBRATE_IO(num_physical_disks=>4, max_latency=>10,
     max_iops=>l_iops, max_mbps=>l_mbps, actual_latency=>l_lat);
  DBMS_OUTPUT.PUT_LINE(\'IOPS=\'||l_iops||\' MBPS=\'||l_mbps||\' LAT=\'||l_lat);
END;
/
-- file level latency
SELECT name, phyrds, readtim, ROUND(readtim*10/NULLIF(phyrds,0),2) avg_ms FROM v$filestat f JOIN v$datafile d USING(file#) ORDER BY avg_ms DESC FETCH FIRST 5 ROWS ONLY;

SELECT event, wait_time_milli, wait_count FROM v$event_histogram WHERE event=\'db file sequential read\';`},
{t:[['Tool','Shows'],
['`CALIBRATE_IO`','Max IOPS, MB/s and latency of the storage'],
['`V$FILESTAT` / `V$IOSTAT_FILE`','Reads, writes and time per file'],
['`V$EVENT_HISTOGRAM`','Distribution of wait times'],
['`DBA_HIST_IOSTAT_*`','History in AWR']]},
{note:'Run calibration when the system is idle, or results are polluted. Compare with the storage vendor numbers.'}],
src:[['I/O calibration',PT]]};

/* ---------- 2: Linux tools ---------- */
L['ora-perf:8:2']={blocks:[
{p:'When the database says "waiting for I/O" or "CPU", the OS shows **why**. Learn five commands.'},
{t:[['Tool','Question','Look at'],
['`top` / `htop`','Which process uses CPU?','%CPU, load average'],
['`vmstat 5`','Is CPU, memory or I/O the limit?','`r` run queue, `b` blocked, `wa` I/O wait, `si/so` swapping'],
['`iostat -x 5`','Is a device busy or slow?','`await` (ms), `%util`, `r/s w/s`, `avgqu-sz`'],
['`sar`','History of the above','CPU, disk, network over the day'],
['`free -m`, `/proc/meminfo`','Memory and swap','Swap use, HugePages'],
['`perf`, `strace`','Deep CPU or system call analysis','Only when needed']]},
{code:`vmstat 5 5
iostat -x 5 3
sar -u 1 5
cat /proc/meminfo | grep -i huge`},
{h:'Quick reading'},
{ul:['Run queue (`r`) much higher than cores: CPU is short.','`si/so` above zero: **swapping**. Oracle will suffer. Reduce memory use.','`await` high with `%util` near 100: the device is saturated.']},
{note:'Swapping an Oracle SGA is one of the worst things for performance. Check swap before any deep database tuning.'}],
src:[['Operating system tools',PT]]};

/* ---------- 3: ASM and filesystems ---------- */
L['ora-perf:8:3']={blocks:[
{p:'Where the files live affects performance and operations.'},
{svg:stack},
{t:[['Option','Strengths','Notes'],
['**ASM**','Striping and mirroring, online rebalance, direct I/O, RAC-ready','Recommended for most production systems'],
['**Filesystem (XFS, ext4)**','Familiar','Use direct I/O and async I/O options. Avoid double caching.'],
['**NFS (dNFS)**','Direct NFS client in Oracle, flexible','Needs a good network'],
['**Exadata storage**','Offload and flash','See the Exadata sub-course']]},
{h:'Design hints'},
{ul:['Stripe across **many** devices for throughput.','Separate redo from data if the storage is not flash.','Keep disk groups similar in size and speed.','Use `ASM_POWER_LIMIT` for rebalance without hurting the workload.']},
{note:'With ASM, there is no filesystem cache to double-buffer. Oracle manages caching, which is usually what you want.'}],
src:[['ASM',O.ASM]]};

/* ---------- 4: Direct and async I/O ---------- */
L['ora-perf:8:4']={blocks:[
{p:'Two I/O settings change how Oracle talks to the OS.'},
{t:[['Setting','Meaning','Recommended'],
['**Direct I/O**','Bypass the OS filesystem cache','On for filesystem datafiles'],
['**Asynchronous I/O**','Issue many I/Os without waiting for each','On'],
['`FILESYSTEMIO_OPTIONS`','`SETALL` = both. `DIRECTIO`, `ASYNCH`, `NONE`','`SETALL` on filesystems. ASM does this itself.'],
['`DISK_ASYNCH_IO`','Enable async for datafiles','TRUE (default)']]},
{code:`SHOW PARAMETER filesystemio_options
SHOW PARAMETER disk_asynch_io

SELECT file_no, filetype_name, asynch_io, small_read_megabytes FROM v$iostat_file;`},
{h:'Why'},
{ul:['Without direct I/O, data is cached twice (OS and SGA), wasting memory and CPU.','Without async I/O, DBWR waits for each write and falls behind (`free buffer waits`).']},
{note:'Check the value after a filesystem change. A common cause of slow checkpoints is `FILESYSTEMIO_OPTIONS=NONE` after a migration.'}],
src:[['I/O settings',PT]]};

/* ---------- 5: Network latency ---------- */
L['ora-perf:8:5']={blocks:[
{p:'The network is part of the database response time. A fast SQL can look slow when the **round trips** are many or the latency is high.'},
{t:[['Symptom','Cause','Fix'],
['`SQL*Net message from client` large in a trace','The client does little work between calls, or latency is high','Reduce round trips'],
['Many `fetch` calls, few rows each','Small array size','Increase `ARRAYSIZE` (or fetch size in the driver)'],
['`SQL*Net more data to client`','Large result over small SDU','Increase `SDU`'],
['Slow only over the WAN','Latency x number of calls','Batch calls, move the app, use stored procedures'],
['Slow DB link queries','Row-by-row over the link','Use set-based SQL, `DRIVING_SITE` hint']]},
{code:`-- client side (SQL*Plus)
SET ARRAYSIZE 500

-- sqlnet.ora / listener.ora (both sides)
DEFAULT_SDU_SIZE=65535`},
{h:'Quick estimate'},
{p:'Time lost to the network is roughly **round trips x latency**. 10,000 round trips at 20 ms are 200 seconds, even if the database needs a second.'},
{note:'Measure with a trace (`SQL*Net message from client` per call) before changing anything. Many times the fix is in the application loop.'}],
src:[['Network performance',O.D+'netag/']]};

/* ---------- 6: Practical ---------- */
L['ora-perf:8:6']={blocks:[
{p:'Find an **I/O bottleneck end to end**.'},
{flow:['Run a scan-heavy and a commit-heavy workload at the same time','Watch `iostat -x 5` and `vmstat 5` on the host','Check top waits in `V$SYSTEM_EVENT` or ASH','Check latency with `V$EVENT_HISTOGRAM`','Compare with `CALIBRATE_IO` results','Decide: SQL, memory, storage or configuration']},
{code:`-- database side
SELECT event, total_waits, ROUND(time_waited_micro/total_waits/1000,2) avg_ms
FROM v$system_event WHERE wait_class IN (\'User I/O\',\'System I/O\',\'Commit\') ORDER BY time_waited_micro DESC FETCH FIRST 6 ROWS ONLY;

-- host side
iostat -x 5 3`},
{h:'Fill this table'},
{t:[['Question','Your finding'],
['Which wait takes most time?',''],
['Average latency of that wait?',''],
['Device `await` and `%util` at the same time?',''],
['Is swap in use?',''],
['Most likely cause (SQL, config, storage)?','']]},
{h:'Check your result'},
{ul:['Database latency and OS `await` agree. If not, look for queueing or the network.','You can state if the problem is workload (too many I/Os) or capacity (slow device).']},
{note:'Always correlate **two** views, database and OS. One view alone often misleads.'}],
src:[['I/O diagnosis',PT]]};

})();
