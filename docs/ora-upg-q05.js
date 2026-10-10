/* LearnSphere - Upgrade quiz, Section 05: Migration Methods.
   window.QUIZZES['ora-upg:4']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-upg:4']={qs:[
{q:'What drives the **choice** of a migration method?',o:['Downtime, size and platform','Color','Brand','Mood'],a:0,why:'Simplest that meets the budget.',lec:0},
{q:'Which fits a **small** database with hours of downtime allowed?',o:['Data Pump','GoldenGate','ZDM','Exadata'],a:0,why:'Simple.',lec:0},
{q:'Which moves between **any platform and version** with near zero downtime?',o:['GoldenGate','Data Pump','RMAN','Cold copy'],a:0,why:'Logical replication.',lec:0},
{q:'Do not use GoldenGate when:',o:['Data Pump fits in the window','Platforms differ','Downtime is zero','Releases differ'],a:0,why:'Use the simpler tool.',lec:0},
{q:'Which option makes the export **consistent**?',o:['FLASHBACK_SCN or FLASHBACK_TIME','PARALLEL','COMPRESSION','CONTENT'],a:0,why:'While live.',lec:1},
{q:'What does **NETWORK_LINK** do?',o:['Imports directly over a database link','Encrypts','Compresses','Deletes'],a:0,why:'No dump file.',lec:1},
{q:'What is needed for **parallel** with dump files?',o:['%U in the dumpfile name','A new user','A tablespace','A role'],a:0,why:'Multiple files.',lec:1},
{q:'Does FULL export include **SYS** objects?',o:['No','Yes','Only tables','Only views'],a:0,why:'Plan users and jobs.',lec:1},
{q:'What does TTS move?',o:['Datafiles plus metadata','Only rows','Only logs','Only users'],a:0,why:'Faster than rows.',lec:2},
{q:'What must tablespaces be during TTS **export**?',o:['Read only','Offline always','Dropped','Encrypted'],a:0,why:'Consistent set.',lec:2},
{q:'How do you **shorten** the read-only window?',o:['Pre-copy with incremental backups','More CPUs','Smaller SGA','Nothing'],a:0,why:'Cross-platform incrementals.',lec:2},
{q:'Which parameter does a **full transportable** export need?',o:['TRANSPORTABLE=ALWAYS with FULL=Y','CONTENT=DATA','PARALLEL','TABLES'],a:0,why:'Whole database.',lec:2},
{q:'Which view shows **endianness**?',o:['V$TRANSPORTABLE_PLATFORM','V$LOG','V$DATABASE_ENDIAN','V$OSSTAT'],a:0,why:'Platform list.',lec:3},
{q:'Which command **converts** datafiles?',o:['RMAN CONVERT DATAFILE','COPY','DD','SCP'],a:0,why:'On source or target.',lec:3},
{q:'Linux x86 to Linux x86 needs:',o:['No conversion','Conversion','Export only','New OS'],a:0,why:'Same endian.',lec:3},
{q:'What is the **lowest-downtime** simple move to new hardware?',o:['Standby and switchover','Cold copy','Export','Rebuild'],a:0,why:'Minutes.',lec:4},
{q:'What does **DBMS_ROLLING** support?',o:['Rolling upgrade with a short outage','Backups','Exports','Patches only'],a:0,why:'Release upgrade.',lec:4},
{q:'What should you test in a Data Guard migration?',o:['Switchover and fallback','Nothing','Only startup','Only backup'],a:0,why:'Rehearse.',lec:4},
{q:'Which gives a **fallback** by reverse replication?',o:['GoldenGate','Data Pump','TTS','Cold copy'],a:0,why:'Old system stays current.',lec:5},
{q:'Where is GoldenGate migration covered in depth?',o:['The GoldenGate sub-course','This section only','A blog','Nowhere'],a:0,why:'Zero-downtime migration section.',lec:5},
{q:'What does **ZDM** do?',o:['Orchestrates migration to Oracle cloud targets','Backups','Patches only','Monitoring'],a:0,why:'Uses Data Guard or Data Pump.',lec:6},
{q:'What is the safe **first** ZDM command?',o:['Run with -eval','Run the migration','Delete','Switch'],a:0,why:'Checks only.',lec:6},
{q:'Which ZDM mode uses **Data Guard**?',o:['Physical online','Logical offline','Logical online only','None'],a:0,why:'Minutes of downtime.',lec:6},
{q:'In the practical, what is recorded **first**?',o:['The SCN on the source','The password','The OS','Disk size'],a:0,why:'Consistent export point.',lec:7},
{q:'How do you **verify** the migration?',o:['Compare row counts and checksums','Look at it','Ask users','Nothing'],a:0,why:'Evidence.',lec:7},
{q:'What must you have at **cutover**?',o:['A fallback to the source','Nothing','A holiday','A new license'],a:0,why:'Safe switch.',lec:7}
]};
