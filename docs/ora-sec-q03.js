/* LearnSphere - Security quiz, Section 03: Authorization & Least Privilege.
   window.QUIZZES['ora-sec:2']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:2']={qs:[
{q:'What should privileges be **granted to**?',o:['Roles, then roles to users','Only users directly','PUBLIC','SYS'],a:0,why:'Easier to manage and audit.',lec:0},
{q:'A **schema privilege** gives access to:',o:['All objects of one schema','All schemas','One column','The OS'],a:0,why:'Includes future objects.',lec:0},
{q:'Which view lists **system privileges**?',o:['DBA_SYS_PRIVS','DBA_TAB_PRIVS','DBA_ROLES','V$LOG'],a:0,why:'Object privileges are in DBA_TAB_PRIVS.',lec:0},
{q:'Which is **narrower**?',o:['Object privilege','System privilege','DBA role','ANY privilege'],a:0,why:'One object.',lec:0},
{q:'Why is `SELECT ANY TABLE` **risky**?',o:['Reads all tables of all schemas','It is slow','It is free','It locks'],a:0,why:'Avoid.',lec:1},
{q:'Why review **PUBLIC grants**?',o:['Everyone, including future accounts, has them','They are faster','They are encrypted','They are audited'],a:0,why:'Quiet risk.',lec:1},
{q:'Which package can allow **network access**?',o:['UTL_HTTP','DBMS_OUTPUT','DBMS_STATS','DBMS_LOCK'],a:0,why:'Also UTL_TCP, UTL_SMTP.',lec:1},
{q:'Why revoke carefully in **test first**?',o:['Applications may use them','It is required','It deletes data','It stops RMAN'],a:0,why:'Replace with specific grants.',lec:1},
{q:'What does **privilege analysis** record?',o:['Privileges actually used','Passwords','SQL text only','Backups'],a:0,why:'Then list unused ones.',lec:2},
{q:'Which package does it?',o:['DBMS_PRIVILEGE_CAPTURE','DBMS_STATS','DBMS_RLS','DBMS_SCHEDULER'],a:0,why:'CREATE_CAPTURE.',lec:2},
{q:'How long should a capture **run**?',o:['A full business cycle','One minute','One query','One day only'],a:0,why:'Include rare jobs.',lec:2},
{q:'Which view lists **unused** privileges?',o:['DBA_UNUSED_PRIVS','DBA_USERS','V$LOCK','DBA_JOBS'],a:0,why:'After GENERATE_RESULT.',lec:2},
{q:'Definer\'s rights run with:',o:['The owner\'s privileges','The caller\'s','SYS','None'],a:0,why:'Default.',lec:3},
{q:'Which clause gives **invoker\'s rights**?',o:['AUTHID CURRENT_USER','AUTHID DEFINER','SECURITY INVOKER','RUN AS CALLER'],a:0,why:'Caller privileges.',lec:3},
{q:'What is a good security use of **definer** rights?',o:['A narrow procedure as a boundary','Dynamic SQL from input','A shared utility','All code'],a:0,why:'Users get only what code does.',lec:3},
{q:'What is a **risk** with definer procedures?',o:['Dynamic SQL injection with owner power','They are slow','They are free','They are invisible'],a:0,why:'Use binds.',lec:3},
{q:'A **secure application role** is enabled by:',o:['Its own package when conditions are met','The user at will','The OS','The listener'],a:0,why:'IDENTIFIED USING package.',lec:4},
{q:'Which function returns the **client IP**?',o:['SYS_CONTEXT(\'USERENV\',\'IP_ADDRESS\')','USER','UID','SYSDATE'],a:0,why:'USERENV namespace.',lec:4},
{q:'Who can set an **application context**?',o:['Only its trusted package','Any user','Only SYS','The OS'],a:0,why:'Defined in CREATE CONTEXT.',lec:4},
{q:'In the practical, what is replaced by a **minimal role**?',o:['The DBA role','The password','The profile','The tablespace'],a:0,why:'Based on captured use.',lec:5},
{q:'How do you **prove** the minimal role is enough?',o:['Run the application tests','Guess','Wait','Restart'],a:0,why:'Tests still pass.',lec:5},
{q:'What does the capture **condition** limit?',o:['Which sessions are recorded','Memory','Disk','Backups'],a:0,why:'For example by session user.',lec:5},
{q:'Should the application connect as **DBA**?',o:['No','Yes','Only at night','Only in test'],a:0,why:'Least privilege.',lec:5},
{q:'WITH ADMIN OPTION should be used:',o:['Only for specific delegation','Everywhere','For PUBLIC','Never reviewed'],a:0,why:'Limits spread.',lec:0},
{q:'Which gives **narrow extra privileges** to code only?',o:['GRANT role TO PROCEDURE','GRANT DBA','ANY privilege','PUBLIC'],a:0,why:'Code-based access.',lec:3}
]};
