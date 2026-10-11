/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 08: Backup Security.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const enc=M.dg(700,200,[
[10,20,160,60,'Database master key|in master',0],[210,20,160,60,'Certificate|in master',2],[410,20,130,60,'Backup|AES_256',2],[580,20,110,60,'Encrypted|.bak file',0],
[10,110,680,70,'To restore elsewhere you need the same certificate and its private key. Without them the backup cannot be read.',0]],
[[170,50,210,50],[370,50,410,50],[540,50,580,50]]);

const tde=M.dg(700,200,[
[10,15,130,60,'Windows DPAPI|or password',0],[170,15,140,60,'Database master|key (master)',0],[340,15,140,60,'Certificate|(master)',2],[510,15,180,60,'Database encryption|key (in the database)',0],
[10,105,680,80,'TDE encrypts data, log and backups. Back up the certificate and the private key as soon as you create them.',0]],
[[140,45,170,45],[310,45,340,45],[480,45,510,45]]);

const rst=M.dg(700,170,[
[10,25,170,70,'Target instance|master key created',0],[210,25,200,70,'CREATE CERTIFICATE|FROM FILE|WITH PRIVATE KEY',2],[440,25,250,70,'RESTORE DATABASE|backup opens because the|certificate matches',0],
[10,115,680,40,'Order matters: the certificate must exist before you restore a TDE or encrypted backup',0]],
[[180,60,210,60],[410,60,440,60]]);

const shr=M.dg(700,150,[
[10,25,200,70,'Backup folder|NTFS rights: SQL service|account and backup admins',2],[250,25,200,70,'Network share|SMB 3 encryption|no everyone access',0],[490,25,200,70,'Off-site copy|immutable or|offline',0]],
[]);

/* ---------- 0: Backup encryption ---------- */
L['mss-bkp:7:0']={blocks:[
{p:'A backup is a complete copy of your data. Anyone who gets the file can read it unless it is **encrypted**. SQL Server can encrypt backups natively with AES.'},
{svg:enc},
{code:`-- One time: master key and a certificate in master
USE master;
CREATE MASTER KEY ENCRYPTION BY PASSWORD = '<strong password>';
CREATE CERTIFICATE BackupCert WITH SUBJECT = 'Backup encryption certificate';

-- Back up the certificate and its private key at once
BACKUP CERTIFICATE BackupCert TO FILE = 'S:\\Keys\\BackupCert.cer'
  WITH PRIVATE KEY (FILE = 'S:\\Keys\\BackupCert.pvk',
                    ENCRYPTION BY PASSWORD = '<another strong password>');

-- Encrypted, compressed backup
BACKUP DATABASE SalesDB TO DISK = 'E:\\Backup\\SalesDB_enc.bak'
  WITH COMPRESSION, CHECKSUM,
       ENCRYPTION (ALGORITHM = AES_256, SERVER CERTIFICATE = BackupCert);`},
{h:'Notes'},
{ul:['Supported algorithms include AES_128, AES_192 and **AES_256**.','Encryption works together with **compression**.','The certificate and keys must be stored **away from the backups**.','Encryption protects the file. It does not replace access control on the folder.']},
{note:'Keep passwords for keys in a secret manager. A lost password for a certificate backup is as bad as a lost certificate.'}],
src:[['Backup encryption',M.RD+'backup-restore/backup-encryption'],['BACKUP CERTIFICATE',M.TS+'statements/backup-certificate-transact-sql']]};

/* ---------- 1: TDE certificates ---------- */
L['mss-bkp:7:1']={blocks:[
{p:'**Transparent Data Encryption (TDE)** encrypts data files and the log, and so every backup of a TDE database is also encrypted. Its keys form a chain, and the **certificate** is the part you can never lose.'},
{svg:tde},
{h:'What to back up and when'},
{t:[['Item','Back up','When'],
['**Certificate and private key**','BACKUP CERTIFICATE ... WITH PRIVATE KEY','Immediately after creating'],
['**Database master key**','BACKUP MASTER KEY','After creating, and after changes'],
['**Passwords** for those backups','Secret manager','At the same time'],
['**Key rotation record**','Runbook','Every rotation']]},
{code:`SELECT d.name, dek.encryption_state, dek.encryptor_type, c.name AS certificate_name,
       c.expiry_date, c.pvt_key_last_backup_date
FROM   sys.dm_database_encryption_keys dek
JOIN   sys.databases d ON d.database_id = dek.database_id
LEFT   JOIN master.sys.certificates c ON c.thumbprint = dek.encryptor_thumbprint;`},
{note:'The column pvt_key_last_backup_date tells you if the private key has ever been backed up. If it is NULL for a certificate protecting TDE, back it up now.'}],
src:[['Transparent data encryption',M.RD+'security/encryption/transparent-data-encryption'],['sys.dm_database_encryption_keys',M.RD+'system-dynamic-management-views/sys-dm-database-encryption-keys-transact-sql']]};

/* ---------- 2: Restoring TDE ---------- */
L['mss-bkp:7:2']={blocks:[
{p:'To restore a TDE-protected backup on another server, that server needs the **same certificate with its private key** first. The database is unreadable without it.'},
{svg:rst},
{code:`USE master;
-- Needs a database master key on the target
CREATE MASTER KEY ENCRYPTION BY PASSWORD = '<strong password>';

CREATE CERTIFICATE TdeCert
  FROM FILE = 'S:\\Keys\\TdeCert.cer'
  WITH PRIVATE KEY (FILE = 'S:\\Keys\\TdeCert.pvk',
                    DECRYPTION BY PASSWORD = '<password used at backup>');

RESTORE DATABASE SalesDB FROM DISK = 'E:\\Backup\\SalesDB_full.bak'
  WITH MOVE 'SalesDB_d1' TO 'D:\\Data\\SalesDB_d1.ndf', RECOVERY;`},
{h:'Typical error'},
{t:[['Message','Meaning'],
['**Cannot find server certificate with thumbprint ...**','The target does not have the certificate'],
['**The certificate private key is not found**','Certificate imported without its private key']]},
{ul:['Test this **restore on a fresh server** at least once a year.','Use the same certificate **name and thumbprint**, not a new one.','After the restore, take a **new backup of the certificate** if rotation is due.']}],
src:[['Move a TDE protected database to another SQL Server',M.RD+'security/encryption/move-a-tde-protected-database-to-another-sql-server'],['CREATE CERTIFICATE',M.TS+'statements/create-certificate-transact-sql']]};

/* ---------- 3: Securing files ---------- */
L['mss-bkp:7:3']={blocks:[
{p:'Backups are often the **weakest point** in database security. A well-secured production server loses its value if its backups sit on an open share.'},
{svg:shr},
{h:'Controls to put in place'},
{t:[['Area','Control'],
['**Folder permissions**','Only the SQL Server service account and backup administrators'],
['**Network share**','No "Everyone", SMB encryption, separate from the database host'],
['**Encryption**','Backup or TDE encryption, keys stored apart'],
['**Retention**','Delete what is no longer needed; keep what regulations require'],
['**Off-site / immutable**','Protected from deletion for a set period'],
['**Auditing**','Log who reads or copies backup files'],
['**Copies for dev and test**','Mask or subset before use; treat as production if not masked']]},
{h:'Common mistakes'},
{ul:['Restoring a **production backup to a developer laptop**.','Leaving **old backups** on the data server disk.','Putting **keys and backups** on the same share.','Using a **domain admin** account for backup jobs.']},
{note:'Treat backup storage like production. If a backup contains personal data, the same legal and company rules apply to it.'}],
src:[['Security considerations for backup and restore',M.RD+'backup-restore/security-considerations-for-backup-and-restore'],['Backup encryption',M.RD+'backup-restore/backup-encryption']]};

})();
