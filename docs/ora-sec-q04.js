/* LearnSphere - Security quiz, Section 04: Network Security & Encryption in Transit.
   window.QUIZZES['ora-sec:3']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:3']={qs:[
{q:'Where is **native encryption** configured?',o:['sqlnet.ora','listener.ora only','The SPFILE','The OS'],a:0,why:'Server and client.',lec:0},
{q:'Which value makes a connection **fail** if not encrypted?',o:['REQUIRED','ACCEPTED','REQUESTED','REJECTED'],a:0,why:'Set on the server.',lec:0},
{q:'What does the **checksum** provide?',o:['Integrity','Encryption','Speed','Compression'],a:0,why:'Detects changes in transit.',lec:0},
{q:'What is the default encryption setting?',o:['ACCEPTED','REQUIRED','REJECTED','REQUESTED'],a:0,why:'Only if the other side asks.',lec:0},
{q:'What does **TLS** need?',o:['Certificates and wallets','Nothing','A password file','A tablespace'],a:0,why:'Also TCPS listener.',lec:1},
{q:'Which port is **commonly** used for TCPS?',o:['2484','1521','22','80'],a:0,why:'Customizable.',lec:1},
{q:'Which gives **server authentication**?',o:['TLS','Native encryption only','None','Compression'],a:0,why:'Via certificate.',lec:1},
{q:'What should you plan for with TLS?',o:['Certificate renewal','Nothing','Password reset','Disk growth'],a:0,why:'Expired certificates stop connections.',lec:1},
{q:'Which listener parameter limits admin to **file edits**?',o:['ADMIN_RESTRICTIONS_LISTENER','LOG_STATUS','TRACE_LEVEL','SAVE_CONFIG_ON_STOP'],a:0,why:'Set ON.',lec:2},
{q:'Which file has **valid node checking**?',o:['sqlnet.ora','tnsnames.ora','init.ora','oratab'],a:0,why:'TCP.VALIDNODE_CHECKING.',lec:2},
{q:'Is changing the **port** a strong control?',o:['No, only a minor one','Yes, complete','It encrypts','It authenticates'],a:0,why:'Use firewalls.',lec:2},
{q:'Valid node checking is:',o:['A basic second layer','A replacement for firewalls','Encryption','Auditing'],a:0,why:'Not a replacement.',lec:2},
{q:'Which proxy filters **by rules** and can multiplex?',o:['Connection Manager','Listener','RMAN','ASM'],a:0,why:'CMAN.',lec:3},
{q:'Where should the database be?',o:['In a protected data zone','In the DMZ','On the internet','On a laptop'],a:0,why:'Only app tier reaches it.',lec:3},
{q:'How should administrators connect?',o:['Through a bastion or VPN with MFA','Directly from home','From any laptop','Anonymously'],a:0,why:'Audited point.',lec:3},
{q:'Which is a **risk** of fixed-user links?',o:['Stored credentials and shared access','They are faster','They encrypt','They audit'],a:0,why:'Use CURRENT_USER or wallets.',lec:4},
{q:'Which view lists **links**?',o:['DBA_DB_LINKS','DBA_USERS','V$LOG','DBA_ROLES'],a:0,why:'Review and drop unused.',lec:4},
{q:'Which link type is better for **access control**?',o:['Private, least-privilege','Public with SYS','Any','Anonymous'],a:0,why:'Minimal remote account.',lec:4},
{q:'Which view verifies **encryption** of a session?',o:['V$SESSION_CONNECT_INFO','V$LOG','V$LOCK','V$SQL'],a:0,why:'Shows the banner.',lec:5},
{q:'What can **REQUIRED** break?',o:['Old clients and drivers','New clients only','Backups','Listeners only'],a:0,why:'Test first.',lec:5},
{q:'What belongs in the **calendar**?',o:['Certificate expiry','Nothing','Backup size','SGA size'],a:0,why:'Prevent outages.',lec:5},
{q:'Which statement is true for **TCPS**?',o:['Uses TLS','Is plain text','Is a backup protocol','Is a storage protocol'],a:0,why:'Secure TCP.',lec:1},
{q:'Which setting excludes **specific hosts**?',o:['TCP.EXCLUDED_NODES','TCP.CONNECT_TIMEOUT','EXPIRE_TIME','SDU'],a:0,why:'With valid node checking.',lec:2},
{q:'A compromised application tier means the data zone should allow:',o:['Only defined ports from that tier','Everything','Internet','Nothing'],a:0,why:'Assume breach.',lec:3},
{q:'Production links from test systems should be:',o:['Not allowed or dropped after a copy','Kept','Public','Shared'],a:0,why:'Avoid data leakage.',lec:4}
]};
