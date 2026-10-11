/* LearnSphere - SQL Server Security & Compliance quiz, Section 10: Compliance & Capstone.
   Format: see pg-quiz.js. window.QUIZZES['mss-sec:9']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-sec:9']={qs:[
{q:'What do regulations such as GDPR and PCI DSS specify?',
 o:['Requirements that you map to controls and evidence','Exact SQL Server settings','Server names','Backup file formats'],
 a:0,why:'They state requirements. You choose and prove controls that meet them.',lec:0},
{q:'Which control supports **restricting access to need to know**?',
 o:['Roles and least privilege','Compression','Statistics','Collation'],
 a:0,why:'Least privilege gives users only what their job needs.',lec:0},
{q:'What is **separation of duties**?',
 o:['No one person controls a whole sensitive process','Using separate disks','Using several servers','Separate passwords for each table'],
 a:0,why:'Splitting duties reduces fraud and the impact of mistakes.',lec:1},
{q:'Which is a good **compensating control** when duties cannot be separated?',
 o:['Extra review and logging','Removing the audit','Sharing admin passwords','Disabling backups'],
 a:0,why:'Additional review and audit reduce the risk when a person holds several duties.',lec:1},
{q:'Why **save the output** of checklist queries with dates?',
 o:['It is evidence and shows trends','To fill disk space','To slow queries','It is required by SQL Server'],
 a:0,why:'Auditors need proof, and trends show drift.',lec:2},
{q:'Which query helps check **connection encryption**?',
 o:['sys.dm_exec_connections.encrypt_option','sys.indexes','sys.partitions','sys.tables'],
 a:0,why:'encrypt_option shows whether a session is encrypted.',lec:2},
{q:'In the capstone, how do you **prove** TDE and key backup work?',
 o:['Restore the encrypted database on a second instance','Run SELECT 1','Take a screenshot of the login','Reboot'],
 a:0,why:'A restore on another instance with the backed up certificate proves recoverability.',lec:3},
{q:'What belongs in the **final report**?',
 o:['Findings, fixes, evidence and residual risk','Only opinions','Only passwords','Only graphs'],
 a:0,why:'A security report must show what was found, changed and still open.',lec:3}
]};
