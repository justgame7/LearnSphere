/* LearnSphere - Backup & Recovery quiz, Section 09: Enterprise Backup, Cloud & Ransomware Resilience.
   window.QUIZZES['ora-bkp:8']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-bkp:8']={qs:[
{q:'What does the Recovery Appliance receive in **real time**?',o:['Redo','Datafiles','Listener logs','Trace files'],a:0,why:'Gives near-zero loss.',lec:0},
{q:'What is **incremental forever**?',o:['One level 0, then only level 1, with virtual fulls','Daily full backups','No backups','Only logs'],a:0,why:'Virtual full backups are built.',lec:0},
{q:'What is ZDLRA best suited for?',o:['A fleet of critical databases','One small test database','A laptop','An application server'],a:0,why:'Central policy and low load.',lec:0},
{q:'Which are **benefits** of ZDLRA?',o:['Lower RPO','Less load on production','Central policy and reporting','No need for any backup'],a:[0,1,2],why:'It still is a backup system.',lec:0},
{q:'What limits **restore from the cloud**?',o:['Network bandwidth','SGA size','Listener','CPU only'],a:0,why:'Plus egress.',lec:1},
{q:'Where should **recent backups** be kept?',o:['On local disk','Only in the cloud','Only on tape','Nowhere'],a:0,why:'Fast restore.',lec:1},
{q:'What should happen **before** data leaves the premises?',o:['Encrypt it','Delete it','Rename it','Compress only'],a:0,why:'Protect the data.',lec:1},
{q:'How long to restore **20 TB over 1 Gbps**?',o:['More than a day','Minutes','A second','An hour'],a:0,why:'About 44 hours.',lec:1},
{q:'What does **immutability** provide?',o:['A backup cannot be deleted or changed for a retention time','Faster backup','Smaller backup','Free storage'],a:0,why:'WORM.',lec:2},
{q:'What is an **air gap**?',o:['A copy isolated from the network','A cable','A faster disk','A backup type'],a:0,why:'Tape or a separate account.',lec:2},
{q:'Why use **separate credentials** for backups?',o:['A stolen production admin cannot delete backups','It is faster','It is required by RMAN','It reduces CPU'],a:0,why:'Isolation.',lec:2},
{q:'What does the **rule of three** include?',o:['3 copies, 2 media, 1 off site','1 copy','3 sites','2 copies'],a:0,why:'Standard guidance.',lec:3},
{q:'Which backs up **on the standby**?',o:['Standby offload','Primary only','Network backup','None'],a:0,why:'No load on the primary.',lec:3},
{q:'Can a **standby backup** restore the primary?',o:['Yes, files are interchangeable','No','Only on RAC','Only for tables'],a:0,why:'Same database.',lec:3},
{q:'Does a **standby** replace backups?',o:['No','Yes','Only for 26ai','Yes for ransomware'],a:0,why:'It copies mistakes.',lec:4},
{q:'Which gives **time travel**?',o:['Backups and Flashback','Synchronous standby','RAC','Listener'],a:0,why:'A standby follows primary.',lec:4},
{q:'Which provides the **lowest RTO**?',o:['Standby with failover','Tape','Cold backup','Export'],a:0,why:'Already restored.',lec:4},
{q:'What does **separation of duties** require?',o:['The DBA is not the only one who can delete backups','One admin for all','No admin','No audit'],a:0,why:'Reduces insider and credential risk.',lec:5},
{q:'Which privilege should the **backup user** hold?',o:['SYSBACKUP','SYSDBA','DBA','PUBLIC'],a:0,why:'Least privilege.',lec:5},
{q:'Where should **backup credentials** be kept?',o:['In a wallet','In scripts','In the alert log','In the SPFILE'],a:0,why:'Not plain text.',lec:5},
{q:'What is **needed** to restore encrypted backups?',o:['The keystore or password','Nothing','The listener','A new DBID'],a:0,why:'Back up keys separately.',lec:5},
{q:'In the design practical, what answers **ransomware**?',o:['Immutable off-site copy','A larger SGA','More CPUs','A bigger FRA'],a:0,why:'Attackers delete backups first.',lec:6},
{q:'In the practical, which tool gives **RPO zero**?',o:['Synchronous Data Guard','Weekly backup','Export','Tape'],a:0,why:'Near zero loss.',lec:6},
{q:'What must you **calculate** for off-site restore?',o:['Time from bandwidth','CPU use','Memory use','Number of users'],a:0,why:'RTO must hold.',lec:6},
{q:'Where is a good place for **long-term** archive?',o:['A vault with retention lock','The FRA','The listener','SYSTEM tablespace'],a:0,why:'Compliance.',lec:6}
]};
