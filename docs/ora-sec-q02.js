/* LearnSphere - Security quiz, Section 02: Authentication & Identity.
   window.QUIZZES['ora-sec:1']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:1']={qs:[
{q:'What does the database store for a **password**?',o:['A salted hash verifier','The password in clear','A picture','Nothing'],a:0,why:'Verifier.',lec:0},
{q:'Which verifier is **weak** and should be removed?',o:['10G','12C','PBKDF2','SHA-512'],a:0,why:'Case-insensitive.',lec:0},
{q:'Which view shows **verifier versions**?',o:['DBA_USERS.PASSWORD_VERSIONS','V$LOG','DBA_JOBS','V$SESSION'],a:0,why:'Check for 10G.',lec:0},
{q:'Which account type **cannot log in**?',o:['NO AUTHENTICATION (schema only)','Password','External','Global'],a:0,why:'Good for object owners.',lec:0},
{q:'What does `FAILED_LOGIN_ATTEMPTS` do?',o:['Locks after N failures','Expires passwords','Limits sessions','Encrypts'],a:0,why:'Slow guessing.',lec:1},
{q:'Which parameter locks **unused** accounts?',o:['INACTIVE_ACCOUNT_TIME','IDLE_TIME','CONNECT_TIME','SESSIONS_PER_USER'],a:0,why:'For example 60 days.',lec:1},
{q:'Which sets **password complexity**?',o:['PASSWORD_VERIFY_FUNCTION','PASSWORD_LIFE_TIME','FAILED_LOGIN_ATTEMPTS','IDLE_TIME'],a:0,why:'A function.',lec:1},
{q:'Why use separate profiles for **applications**?',o:['Expiry can break applications','They are faster','Required by Oracle','No reason'],a:0,why:'Coordinate changes.',lec:1},
{q:'Which OS group maps to **SYSBACKUP**?',o:['backupdba','dgdba','kmdba','racdba'],a:0,why:'Least privilege groups.',lec:2},
{q:'Which view lists **password file users**?',o:['V$PWFILE_USERS','V$LOG','DBA_ROLES','V$LOCK'],a:0,why:'With admin privilege flags.',lec:2},
{q:'What is the risk of OS authentication?',o:['Anyone in the OS group is an admin','Slow login','No audit','Weak encryption'],a:0,why:'Keep groups small.',lec:2},
{q:'Where should the **password file** be in RAC?',o:['In ASM (shared)','On one node only','In /tmp','Nowhere'],a:0,why:'All nodes need it.',lec:2},
{q:'What does **Kerberos** prove?',o:['Identity with a ticket from the KDC','A password in the DB','A license','A backup'],a:0,why:'No password in the database.',lec:3},
{q:'How is an **external** user created?',o:['IDENTIFIED EXTERNALLY AS ...','IDENTIFIED BY','NO AUTH','LOCKED'],a:0,why:'Mapped to principal or CN.',lec:3},
{q:'Which gives **single sign-on**?',o:['Kerberos or directory','Local password','Password file','None'],a:0,why:'Central policy.',lec:3},
{q:'What does **CMU** need in the database?',o:['A shared schema and global roles','A user per person','No setup','A password file'],a:0,why:'Mapped to directory groups.',lec:4},
{q:'Which clause creates a **global user**?',o:['IDENTIFIED GLOBALLY','IDENTIFIED BY','EXTERNAL','PROXY'],a:0,why:'Mapped by directory.',lec:4},
{q:'What happens at **leaver** with CMU?',o:['Disabled in the directory','Manual in each DB','Nothing','A new user'],a:0,why:'Central control.',lec:4},
{q:'Which provides **MFA** naturally?',o:['Identity provider with tokens','Local password','Password file','None'],a:0,why:'MFA is at the provider.',lec:5},
{q:'What does an application use instead of a stored password?',o:['Cloud identity or resource principal','Plain password','Hard-coded key','Nothing'],a:0,why:'No secrets in config.',lec:5},
{q:'Which validates the **token**?',o:['The database','The listener only','The OS','The backup'],a:0,why:'Then maps user and roles.',lec:5},
{q:'In the practical, `app_owner` should have type:',o:['NONE','PASSWORD','EXTERNAL','GLOBAL'],a:0,why:'Schema only.',lec:6},
{q:'After 5 wrong passwords, the account is:',o:['Locked','Dropped','Expired','Unchanged'],a:0,why:'FAILED_LOGIN_ATTEMPTS 5.',lec:6},
{q:'Which command **unlocks** an account?',o:['ALTER USER ... ACCOUNT UNLOCK','DROP USER','GRANT','REVOKE'],a:0,why:'Document it.',lec:6},
{q:'Which function shows the **authenticated identity**?',o:['SYS_CONTEXT(\'USERENV\',\'AUTHENTICATED_IDENTITY\')','USER','UID','SYSDATE'],a:0,why:'Useful for directory users.',lec:6},
{q:'Which setting rejects **old protocol versions**?',o:['SQLNET.ALLOWED_LOGON_VERSION_SERVER','SDU','TRACE_LEVEL','EXPIRE_TIME'],a:0,why:'Server side.',lec:0}
]};
