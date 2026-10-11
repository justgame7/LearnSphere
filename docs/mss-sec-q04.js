/* LearnSphere - SQL Server Security & Compliance quiz, Section 4: Encryption in Transit.
   Format: see pg-quiz.js. window.QUIZZES['mss-sec:3']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-sec:3']={qs:[
{q:'What does **TLS** give a SQL Server connection?',
 o:['Confidentiality, integrity and server identity','Faster queries','Smaller backups','More logins'],
 a:0,why:'TLS encrypts traffic, detects tampering and lets the client verify the server.',lec:0},
{q:'Which column shows whether a session is **encrypted**?',
 o:['encrypt_option in sys.dm_exec_connections','state in sys.databases','type in sys.objects','status in sys.indexes'],
 a:0,why:'sys.dm_exec_connections.encrypt_option is TRUE for encrypted connections.',lec:0},
{q:'Which are **certificate requirements**?',
 o:['Server Authentication usage','Name matches the name clients use','Private key readable by the service account','Self-signed only'],
 a:[0,1,2],why:'A proper, trusted certificate is needed. Self-signed certificates are not required.',lec:1},
{q:'Where is the certificate installed on the server?',
 o:['Local Computer Personal store','Current User Trusted Root','Desktop','master database'],
 a:0,why:'It is placed in the machine Personal store and selected in Configuration Manager.',lec:1},
{q:'What does **Force Encryption** do?',
 o:['Requires all connections to use TLS','Encrypts the data files','Encrypts backups','Disables SQL logins'],
 a:0,why:'It requires TLS for every client connection.',lec:2},
{q:'What does **TrustServerCertificate=True** do?',
 o:['Skips certificate validation','Makes the certificate stronger','Renews the certificate','Encrypts data at rest'],
 a:0,why:'It accepts any certificate, which removes protection against man-in-the-middle.',lec:2},
{q:'What is **TDS 8.0 strict encryption**?',
 o:['TLS is negotiated first, like HTTPS','A new backup format','A column encryption feature','A tempdb option'],
 a:0,why:'Strict mode establishes TLS before any TDS traffic.',lec:2},
{q:'**The target principal name is incorrect** usually means:',
 o:['The name used is not in the certificate subject or SAN','The disk is full','tempdb is missing','The login is locked'],
 a:0,why:'The client validates the server name against the certificate.',lec:3},
{q:'Where do you first check whether the instance **loaded its certificate**?',
 o:['SQL Server error log','Agent job history','Query Store','Windows calculator'],
 a:0,why:'The log records the certificate load at startup.',lec:3}
]};
