/* LearnSphere - SQL Server Security & Compliance, Section 05: Encryption at Rest: TDE.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const hier=M.dg(700,240,[
[10,10,680,220,'TDE key hierarchy',1],
[30,45,190,45,'Windows DPAPI|service master key',0],[250,45,190,45,'Database master key|in master',0],[470,45,190,45,'Certificate|in master',2],
[250,115,190,45,'Database encryption key|inside the user database',2],[470,115,190,45,'Data and log pages|AES encrypted on disk',0],
[30,180,630,38,'Lose the certificate and its private key and the database and its backups cannot be read',0]],
[[220,67,250,67],[440,67,470,67],[565,90,360,115],[440,137,470,137]]);

const steps=M.dg(700,150,[
[10,25,150,70,'1. Master key|in master',0],[185,25,150,70,'2. Certificate|in master',0],[360,25,150,70,'3. Back up|certificate + key',2],[535,25,155,70,'4. Create DEK,|ENCRYPTION ON',0]],
[[160,60,185,60],[335,60,360,60],[510,60,535,60]]);

const bk=M.dg(700,170,[
[10,25,200,70,'Certificate .cer|and private key .pvk|and passwords',2],[250,25,200,70,'Store away from|the backups: vault,|offline copy',0],[490,25,200,70,'Test a restore|on another server|at least yearly',2],
[10,115,680,40,'pvt_key_last_backup_date NULL means the private key has never been backed up',0]],
[[210,60,250,60],[450,60,490,60]]);

const side=M.dg(700,200,[
[10,15,680,170,'What TDE touches',1],
[30,55,200,50,'tempdb|encrypted once any|database uses TDE',0],[250,55,200,50,'Backups|encrypted, need the cert|to restore',2],[470,55,200,50,'Log shipping and AG|certificate on every|secondary',2],
[30,125,640,50,'Cost: some CPU. Not a protection against a logged-in user: queries still return plaintext.',0]],
[]);

const rot=M.dg(700,170,[
[10,25,200,70,'New certificate|in master|backed up',0],[250,25,200,70,'Re-encrypt the DEK|ENCRYPTION BY|SERVER CERTIFICATE|fast, no data rewrite',2],[490,25,200,70,'Keep old certificate|until old backups|expire',0],
[10,115,680,40,'Regenerating the DEK itself re-encrypts all data: plan for I/O and time',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Key hierarchy ---------- */
L['mss-sec:4:0']={blocks:[
{p:'**Transparent Data Encryption (TDE)** encrypts the data files, log files and backups of a database at rest, with no application change. It protects against **stolen files**, not against users who can query the database.'},
{svg:hier},
{t:[['Key','Where','Protected by'],
['**Service master key**','master','Windows DPAPI'],
['**Database master key (DMK)**','master','Password and service master key'],
['**Certificate**','master','DMK'],
['**Database encryption key (DEK)**','The user database','The certificate']]},
{note:'TDE is available in Standard edition from SQL Server 2019 and in Enterprise from earlier versions. Check the editions page for your release.'}],
src:[['Transparent data encryption',M.RD+'security/encryption/transparent-data-encryption'],['Encryption hierarchy',M.RD+'security/encryption/encryption-hierarchy']]};

/* ---------- 1: Enabling ---------- */
L['mss-sec:4:1']={blocks:[
{p:'Enabling TDE takes four steps. Do them in order and take the certificate backup **before** you turn encryption on.'},
{svg:steps},
{code:`USE master;
CREATE MASTER KEY ENCRYPTION BY PASSWORD = '<strong password>';
CREATE CERTIFICATE TdeCert WITH SUBJECT = 'TDE certificate for SalesDB';

BACKUP CERTIFICATE TdeCert TO FILE = 'S:\\Keys\\TdeCert.cer'
  WITH PRIVATE KEY (FILE = 'S:\\Keys\\TdeCert.pvk',
                    ENCRYPTION BY PASSWORD = '<another strong password>');

USE SalesDB;
CREATE DATABASE ENCRYPTION KEY
  WITH ALGORITHM = AES_256 ENCRYPTION BY SERVER CERTIFICATE TdeCert;
ALTER DATABASE SalesDB SET ENCRYPTION ON;

-- Progress and state
SELECT DB_NAME(database_id) AS db, encryption_state, percent_complete
FROM   sys.dm_database_encryption_keys;`},
{t:[['encryption_state','Meaning'],
['1','Unencrypted'],
['2','Encryption in progress'],
['3','Encrypted'],
['5','Decryption in progress']]},
{note:'The background scan runs while the database is online. On a large database it adds I/O, so run it off-peak.'}],
src:[['Enable TDE',M.RD+'security/encryption/transparent-data-encryption'],['CREATE DATABASE ENCRYPTION KEY',M.TS+'statements/create-database-encryption-key-transact-sql']]};

/* ---------- 2: Backing up certificates ---------- */
L['mss-sec:4:2']={blocks:[
{p:'The certificate is the **only way** to open a TDE database on another server, or after a rebuild. A lost certificate means **lost data**.'},
{svg:bk},
{code:`-- Is the private key backed up?
SELECT name, subject, expiry_date, pvt_key_last_backup_date
FROM   master.sys.certificates
WHERE  name NOT LIKE '##%';

BACKUP MASTER KEY TO FILE = 'S:\\Keys\\master_dmk.key'
  ENCRYPTION BY PASSWORD = '<yet another strong password>';`},
{h:'Rules'},
{ul:['Back up the **certificate, the private key and the DMK**.','Store files and **passwords separately**, in a vault or sealed offline copy.','Keep **two copies** in different places.','**Test a restore** on a fresh server and record the date.','Record **expiry dates**: a TDE certificate can expire, but the data stays readable. Plan rotation anyway.']},
{note:'Without the private key backup, restoring the certificate from the .cer file alone does not work. You need the .pvk file and its password.'}],
src:[['BACKUP CERTIFICATE',M.TS+'statements/backup-certificate-transact-sql'],['Move a TDE database to another server',M.RD+'security/encryption/move-a-tde-protected-database-to-another-sql-server']]};

/* ---------- 3: TDE with backups, tempdb, log shipping ---------- */
L['mss-sec:4:3']={blocks:[
{p:'TDE reaches beyond the one database. Plan for these side effects before you turn it on.'},
{svg:side},
{t:[['Area','What happens','What to do'],
['**tempdb**','Encrypted as soon as any user database is encrypted','Accept the small overhead on all databases'],
['**Backups**','Encrypted automatically','Keep the certificate with the backup retention period'],
['**Backup compression**','Works with TDE (SQL Server 2016 and later, with a larger transfer size)','Test CPU use'],
['**Log shipping / AG / mirroring**','Secondary needs the certificate before it can restore or apply log','Install the certificate on every replica'],
['**Replication**','Distribution and replicated data are not encrypted by TDE','Use other encryption for these']]},

{code:`-- Which databases are encrypted, with which certificate?
SELECT DB_NAME(dek.database_id) AS db, dek.encryption_state, dek.encryptor_thumbprint, c.name AS certificate_name
FROM   sys.dm_database_encryption_keys dek
LEFT   JOIN master.sys.certificates c ON c.thumbprint = dek.encryptor_thumbprint;`}],
src:[['TDE and other features',M.RD+'security/encryption/transparent-data-encryption'],['Backup encryption',M.RD+'backup-restore/backup-encryption']]};

/* ---------- 4: Rotating keys ---------- */
L['mss-sec:4:4']={blocks:[
{p:'Keys and certificates should be **rotated** on a schedule, or when staff with access leave, or if exposure is suspected.'},
{svg:rot},
{code:`USE master;
CREATE CERTIFICATE TdeCert2 WITH SUBJECT = 'TDE certificate 2027';
BACKUP CERTIFICATE TdeCert2 TO FILE = 'S:\\Keys\\TdeCert2.cer'
  WITH PRIVATE KEY (FILE = 'S:\\Keys\\TdeCert2.pvk',
                    ENCRYPTION BY PASSWORD = '<strong password>');

USE SalesDB;
ALTER DATABASE ENCRYPTION KEY ENCRYPTION BY SERVER CERTIFICATE TdeCert2;`},
{h:'Two different rotations'},
{t:[['Rotation','What changes','Cost'],
['**Certificate**','The key that protects the DEK is replaced','Quick: only the small DEK is re-encrypted'],
['**DEK regeneration**','`ALTER DATABASE ENCRYPTION KEY REGENERATE WITH ALGORITHM = AES_256`','Re-encrypts all data: heavy I/O']]},
{ul:['**Keep the old certificate** until every backup that used it is past retention.','Rotate on **every replica** of an availability group.','Update the **runbook** and the secret store with new passwords and dates.']},
{note:'Customer-managed keys in Azure Key Vault (EKM) allow central rotation and access control. They add dependencies, so test failure and recovery carefully.'}],
src:[['ALTER DATABASE ENCRYPTION KEY',M.TS+'statements/alter-database-encryption-key-transact-sql'],['Extensible key management with Azure Key Vault',M.RD+'security/encryption/extensible-key-management-using-azure-key-vault-sql-server']]};

})();
