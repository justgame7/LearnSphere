/* LearnSphere - SQL Server Security & Compliance quiz, Section 6: Always Encrypted.
   Format: see pg-quiz.js. window.QUIZZES['mss-sec:5']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-sec:5']={qs:[
{q:'Who **encrypts and decrypts** data in Always Encrypted?',
 o:['The client driver','The SQL Server engine','The storage array','The Agent'],
 a:0,why:'Encryption happens in the client driver, so SQL Server sees ciphertext only.',lec:0},
{q:'Which feature protects data from a **sysadmin** reading a column?',
 o:['Always Encrypted','TDE','Dynamic Data Masking','TLS'],
 a:0,why:'The keys are not available to the server, so admins cannot decrypt the column.',lec:0},
{q:'Where is the **column master key (CMK)** stored?',
 o:['Outside SQL Server, such as a certificate store or Key Vault','In the database as plaintext','In the log','In msdb'],
 a:0,why:'The CMK never lives in SQL Server. The database holds only its location.',lec:1},
{q:'What does the **CEK** do?',
 o:['Encrypts column data and is stored encrypted by the CMK','Encrypts backups','Authenticates logins','Compresses data'],
 a:0,why:'The CEK is the data-level key. It is stored in the database encrypted by the CMK.',lec:1},
{q:'Which encryption type allows **equality joins**?',
 o:['Deterministic','Randomized','Both','Neither'],
 a:0,why:'Deterministic encryption gives the same ciphertext for the same value, so equality works.',lec:2},
{q:'Which encryption type is **more secure**?',
 o:['Randomized','Deterministic','They are equal','None'],
 a:0,why:'Randomized hides patterns but allows no search.',lec:2},
{q:'What does the application need on the connection?',
 o:['Column Encryption Setting = Enabled','Encrypt = False','Trust all certificates','Nothing'],
 a:0,why:'This tells the driver to encrypt parameters and decrypt results.',lec:2},
{q:'What do **secure enclaves** add?',
 o:['Rich queries and in-place encryption on encrypted data','Smaller backups','More logins','Faster log writes'],
 a:0,why:'Enclaves allow computation inside protected server memory.',lec:3},
{q:'What must happen before a client trusts an **enclave**?',
 o:['Attestation','A backup','A restart','A reorganize'],
 a:0,why:'The client verifies the enclave through an attestation service.',lec:3}
]};
