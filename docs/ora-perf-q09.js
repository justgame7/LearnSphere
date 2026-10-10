/* LearnSphere - Performance quiz, Section 09: Storage, I/O & OS-Level Performance.
   window.QUIZZES['ora-perf:8']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:8']={qs:[
{q:'Which metric matters most for **OLTP**?',o:['IOPS and latency','Only throughput','Capacity','Color'],a:0,why:'Many small random I/Os.',lec:0},
{q:'Which metric matters for **warehouses**?',o:['Throughput','Only latency','IOPS only','None'],a:0,why:'Large scans.',lec:0},
{q:'Why use a **latency histogram**?',o:['Averages hide slow spikes','It is faster','It is required','It saves space'],a:0,why:'V$EVENT_HISTOGRAM.',lec:0},
{q:'What is a healthy **redo write** latency?',o:['A few milliseconds','Seconds','Minutes','Hours'],a:0,why:'Commit time depends on it.',lec:0},
{q:'Which procedure **calibrates** I/O?',o:['DBMS_RESOURCE_MANAGER.CALIBRATE_IO','DBMS_STATS','DBMS_SCHEDULER','DBMS_LOCK'],a:0,why:'Needs a quiet system.',lec:1},
{q:'When should you run **calibration**?',o:['When the system is idle','At peak','During backup','Never'],a:0,why:'Otherwise polluted.',lec:1},
{q:'Which view shows I/O **per file**?',o:['V$FILESTAT','V$LOG','V$SESSION','V$LOCK'],a:0,why:'Reads and time.',lec:1},
{q:'What does **vmstat `si/so`** above zero mean?',o:['Swapping','CPU idle','Network','Locks'],a:0,why:'Very harmful for Oracle.',lec:2},
{q:'Which tool shows **device latency**?',o:['iostat -x (await)','free','ping','ls'],a:0,why:'And %util.',lec:2},
{q:'A run queue much higher than cores means:',o:['CPU is short','Disk is full','Network down','Memory free'],a:0,why:'vmstat r column.',lec:2},
{q:'Which provides **striping and online rebalance**?',o:['ASM','ext4 only','FAT','A tape'],a:0,why:'Recommended for production.',lec:3},
{q:'Which is true for **ASM** and caching?',o:['No filesystem cache double-buffering','Always double cached','No SGA cache','No async I/O'],a:0,why:'Direct I/O.',lec:3},
{q:'What does **ASM_POWER_LIMIT** control?',o:['Rebalance speed','Memory','Users','Logs'],a:0,why:'Balance speed against workload.',lec:3},
{q:'Which value gives **direct and async** I/O on filesystems?',o:['FILESYSTEMIO_OPTIONS=SETALL','NONE','ASYNCH only','DIRECTIO only'],a:0,why:'Both.',lec:4},
{q:'Without direct I/O, data is:',o:['Cached twice','Cached once','Not cached','Encrypted'],a:0,why:'OS and SGA.',lec:4},
{q:'What happens without **async I/O**?',o:['DBWR may fall behind, free buffer waits','Nothing','Faster writes','Less memory'],a:0,why:'Writes wait one by one.',lec:4},
{q:'What estimates **network time**?',o:['Round trips x latency','CPU x memory','Rows only','Tables'],a:0,why:'10,000 x 20 ms = 200 s.',lec:5},
{q:'Which **fixes many small fetches**?',o:['Larger ARRAYSIZE','Smaller SGA','Less memory','Reboot'],a:0,why:'Fewer round trips.',lec:5},
{q:'Which parameter influences **packet size**?',o:['SDU','OPEN_CURSORS','PROCESSES','SESSIONS'],a:0,why:'Session data unit.',lec:5},
{q:'Slow only over the **WAN** suggests:',o:['Latency times calls','Disk full','Index missing','Locks'],a:0,why:'Batch the calls.',lec:5},
{q:'Why correlate **database and OS** views?',o:['One view alone may mislead','It is required','It is faster','It saves licenses'],a:0,why:'Cross-check.',lec:6},
{q:'In the practical, which wait classes do you check?',o:['User I/O, System I/O, Commit','Idle','Network only','Other'],a:0,why:'I/O related.',lec:6},
{q:'A mismatch between DB latency and OS **await** suggests:',o:['Queueing or network between them','Perfect health','Missing index','Wrong user'],a:0,why:'Look at the path.',lec:6},
{q:'Is **swap use** worth checking early?',o:['Yes','No','Only for RAC','Only after a patch'],a:0,why:'It invalidates tuning.',lec:2},
{q:'What decides **SQL vs capacity**?',o:['Number of I/Os versus device speed','User names','Passwords','Tablespace names'],a:0,why:'Workload or capacity.',lec:6}
]};
