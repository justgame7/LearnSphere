/* LearnSphere - Security, Section 05: Data at Rest: Transparent Data Encryption.
   Lectures 0-7 are core, 8+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const AS=O.D+'asoag/';

/* ---------- diagrams ---------- */
const keys=O.dg(700,210,[
[10,60,150,90,'Master encryption|key (MEK)|in the keystore',2],
[220,20,170,60,'Table key|encrypts column data',0],
[220,120,170,60,'Tablespace key|encrypts datafile blocks',0],
[450,60,120,90,'Encrypted|data on disk,|backups, redo',0],
[610,60,80,90,'Wallet|file or HSM',0]],
[[160,95,220,50],[160,115,220,150],[390,50,450,85],[390,150,450,125],[610,105,160,105]]);

/* ---------- 0: TDE concepts ---------- */
L['ora-sec:4:0']={blocks:[
{p:'**Transparent Data Encryption (TDE)** encrypts data **on disk**. Applications need no change. Data is decrypted when Oracle reads it into memory.'},
{svg:keys},
{t:[['Key','Role'],
['**Master encryption key (MEK)**','Top key, held in the keystore. Encrypts the data keys.'],
['**Table key**','Encrypts column data (column encryption)'],
['**Tablespace key**','Encrypts all blocks of a tablespace'],
['**Keystore (wallet)**','File (software) or HSM that stores the MEK']]},
{h:'What TDE protects'},
{ul:['Datafiles, redo and undo of encrypted tablespaces.','Backups of that data (RMAN backups of encrypted tablespaces stay encrypted).','Temp data of encrypted tablespaces.']},
{h:'What TDE does not do'},
{ul:['It does not hide data from users who are authorized to read it.','It does not protect data in memory or on the wire (use TLS).']},
{note:'TDE protects **stolen files and backups**. Access control inside the database is still handled by privileges, redaction and Database Vault.'}],
src:[['Advanced Security Guide',AS]]};

/* ---------- 1: Keystore types ---------- */
L['ora-sec:4:1']={blocks:[
{p:'The **keystore** is the most sensitive file. Choose its type to match your operations.'},
{t:[['Type','Behavior','Use'],
['**Password-protected keystore**','Must be opened with `ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN` after each restart','Highest control, needs manual or scripted open'],
['**Auto-login**','Opens automatically. Can be used on any host (file copied).','Convenient but weaker'],
['**Local auto-login**','Opens automatically **only on the host** where it was created','Practical and safer than auto-login'],
['**HSM / Key Vault**','Keys are held outside the host','Highest assurance, separation of duties']]},
{code:`-- keystore location (sqlnet.ora, or WALLET_ROOT parameter in 19c)
ALTER SYSTEM SET wallet_root=\'/u01/app/oracle/admin/orcl/wallet\' SCOPE=SPFILE;
ALTER SYSTEM SET tde_configuration=\'KEYSTORE_CONFIGURATION=FILE\' SCOPE=BOTH;

ADMINISTER KEY MANAGEMENT CREATE KEYSTORE IDENTIFIED BY "KeystorePw#1";
ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "KeystorePw#1";
ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "KeystorePw#1" WITH BACKUP;
ADMINISTER KEY MANAGEMENT CREATE LOCAL AUTO_LOGIN KEYSTORE FROM KEYSTORE IDENTIFIED BY "KeystorePw#1";

SELECT wrl_type, wrl_parameter, status, wallet_type FROM v$encryption_wallet;`},
{note:'**Always back up the keystore** separately from the data, and test a restore. If the keystore is lost, encrypted data is lost.'}],
src:[['Keystores',AS]]};

/* ---------- 2: Encrypting tablespaces and columns ---------- */
L['ora-sec:4:2']={blocks:[
{p:'Two levels. **Tablespace encryption** is the usual choice.'},
{t:[['','Tablespace encryption','Column encryption'],
['**Scope**','All data in the tablespace','Selected columns'],
['**Indexes**','Fully supported, all range scans work','Limited: only equality searches on indexed columns, no salt'],
['**Overhead**','Low (hardware AES where available)','Higher'],
['**Use**','Almost always','Specific compliance for a few sensitive columns']]},
{code:`CREATE TABLESPACE secure_ts DATAFILE \'/u01/oradata/orcl/secure01.dbf\' SIZE 1G
  ENCRYPTION USING \'AES256\' DEFAULT STORAGE (ENCRYPT);

-- column
ALTER TABLE app.customers MODIFY (card_no ENCRYPT USING \'AES256\' NO SALT);

SELECT tablespace_name, encrypted FROM dba_tablespaces;
SELECT table_name, column_name, encryption_alg FROM dba_encrypted_columns;`},
{h:'Defaults'},
{ul:['Use `AES256` or `AES128`. Both are strong.','Set `ENCRYPT_NEW_TABLESPACES=ALWAYS` so new tablespaces are encrypted by default.']},
{note:'Prefer tablespace encryption. Column encryption changes how the optimizer can use indexes and adds many restrictions.'}],
src:[['Encrypting data',AS]]};

/* ---------- 3: Online conversion ---------- */
L['ora-sec:4:3']={blocks:[
{p:'Existing tablespaces can be encrypted **online** since 12.2, without downtime. Older methods used export/import or moving objects.'},
{code:`-- online encryption of an existing tablespace
ALTER TABLESPACE users ENCRYPTION ONLINE USING \'AES256\' ENCRYPT;

-- progress
SELECT tablespace_name, encrypted FROM dba_tablespaces WHERE tablespace_name=\'USERS\';

-- offline (at mount) alternative
ALTER TABLESPACE users OFFLINE NORMAL;
ALTER TABLESPACE users ENCRYPTION OFFLINE ENCRYPT;
ALTER TABLESPACE users ONLINE;`},
{t:[['Method','Downtime','Notes'],
['**Online**','None','Needs temporary space (about the size of the tablespace for the new copy)'],
['**Offline**','Tablespace offline','Faster, needs the outage'],
['**Move or export/import**','Depends','Fallback for old releases']]},
{flow:['Open the keystore and set a master key','Plan space: free space of about one datafile','Convert tablespace by tablespace (SYSTEM, SYSAUX, UNDO last)','Verify, back up, and remove old plain datafiles safely']},
{note:'Old plain copies of datafiles may remain on disk or in old backups. Securely delete them, or the benefit is lost.'}],
src:[['Converting to TDE',AS]]};

/* ---------- 4: Key rotation ---------- */
L['ora-sec:4:4']={blocks:[
{p:'Rotate keys regularly and when a key may be exposed. There are two rotation operations.'},
{t:[['Operation','What changes','Cost'],
['**Rekey the master key**','New MEK. Table and tablespace keys are re-encrypted (wrapped) with it.','Quick, no data rewrite'],
['**Rekey tablespace keys**','New tablespace data key. Data is re-encrypted.','Heavy, done online with `REKEY`']]},
{code:`-- new master key, with a backup of the old keystore
ADMINISTER KEY MANAGEMENT SET KEY USING TAG \'2026-q4\' IDENTIFIED BY "KeystorePw#1" WITH BACKUP;

-- keys in use
SELECT key_id, creation_time, activation_time, tag FROM v$encryption_keys ORDER BY creation_time;

-- rekey a tablespace key (online)
ALTER TABLESPACE users ENCRYPTION ONLINE REKEY;`},
{h:'Policy'},
{ul:['Rotate the master key at least once a year, or as policy requires.','Keep **old keystore backups**: backups made with old keys need them for restore.','Rotate the master key after staff with key access leave.']},
{note:'Record each rotation: date, reason, who, and backup location. Auditors will ask.'}],
src:[['Key management',AS]]};

/* ---------- 5: TDE in multitenant ---------- */
L['ora-sec:4:5']={blocks:[
{p:'In a CDB, keys are managed in one of two modes.'},
{t:[['','United mode','Isolated mode'],
['**Keystore**','One keystore for the CDB and all PDBs','Each PDB has its own keystore'],
['**Master keys**','Root and each PDB have keys in the same keystore','Separate per PDB'],
['**Who manages**','CDB administrator (and PDB admin for PDB keys)','Each PDB key administrator'],
['**Good for**','One owner, simple operations','Hosting, separation between tenants']]},
{code:`-- united mode: from the root, set keys for all PDBs
ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "pw" WITH BACKUP CONTAINER=ALL;

-- in a PDB (united): its own key
ALTER SESSION SET CONTAINER=pdb1;
ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "pw" WITH BACKUP;

SELECT con_id, status, wallet_type, keystore_mode FROM v$encryption_wallet;`},
{h:'Moving PDBs'},
{ul:['**Unplug and plug**: export the PDB key (`EXPORT ENCRYPTION KEYS`) and import it at the target.','**Clones** need keys available at the target CDB.']},
{note:'Think of operations before you choose. Unplugging an encrypted PDB without the keys makes it unusable at the target.'}],
src:[['TDE in CDBs',AS]]};

/* ---------- 6: Backups, Data Pump, standby ---------- */
L['ora-sec:4:6']={blocks:[
{p:'TDE touches backups, exports and standbys. Plan each one.'},
{t:[['Area','Behavior','Action'],
['**RMAN backups**','Encrypted tablespaces stay encrypted in backups','Back up the keystore separately. Optionally also encrypt the backup set.'],
['**Restore**','Needs the keystore (master key) from the time of the backup','Keep old keystore backups'],
['**Data Pump**','Export can encrypt dumps (`ENCRYPTION=ALL`, `ENCRYPTION_MODE=TRANSPARENT` or `PASSWORD`)','Choose a method that the target can decrypt'],
['**Data Guard standby**','Needs the **same keystore** (or a copy) and the same master keys','Copy the keystore to the standby and keep it in sync after rekey'],
['**Cloning**','Clone needs the source keys','Move the keys with the data']]},
{code:`expdp system@pdb1 schemas=app directory=dp_dir dumpfile=app.dmp encryption=ALL encryption_mode=PASSWORD
-- (you will be prompted for the password)

-- standby: after a master key rekey on the primary
-- copy the updated keystore files to the standby, then
ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "pw";`},
{note:'The most common TDE incident: a failover to a standby that has no current keystore. Test failover with TDE active.'}],
src:[['TDE operations',AS]]};

/* ---------- 7: Practical ---------- */
L['ora-sec:4:7']={blocks:[
{p:'**Encrypt a database** and take a backup that you can restore. Use a test system.'},
{code:`-- 1. keystore and key
ADMINISTER KEY MANAGEMENT CREATE KEYSTORE IDENTIFIED BY "KsPw#1";
ADMINISTER KEY MANAGEMENT SET KEYSTORE OPEN IDENTIFIED BY "KsPw#1";
ADMINISTER KEY MANAGEMENT SET KEY IDENTIFIED BY "KsPw#1" WITH BACKUP;
ADMINISTER KEY MANAGEMENT CREATE LOCAL AUTO_LOGIN KEYSTORE FROM KEYSTORE IDENTIFIED BY "KsPw#1";

-- 2. encrypt
CREATE TABLESPACE enc_ts DATAFILE SIZE 200M ENCRYPTION USING \'AES256\' DEFAULT STORAGE (ENCRYPT);
ALTER TABLE app.orders MOVE ONLINE TABLESPACE enc_ts;
ALTER TABLESPACE users ENCRYPTION ONLINE USING \'AES256\' ENCRYPT;

-- 3. verify
SELECT tablespace_name, encrypted FROM dba_tablespaces;
SELECT status, wallet_type FROM v$encryption_wallet;`},
{flow:['Back up the keystore directory to a separate secure location','Take an RMAN backup','Test: strings on a datafile shows no readable data','Restore test: close the keystore and try to open an encrypted tablespace (it must fail)']},
{h:'Check your result'},
{t:[['Check','Expected'],
['`DBA_TABLESPACES.ENCRYPTED`','YES for the chosen tablespaces'],
['`V$ENCRYPTION_WALLET`','OPEN, LOCAL_AUTOLOGIN'],
['`strings` on datafile','No business text'],
['Keystore backup','Exists, stored separately'],
['Restore test','Succeeds with the keystore, fails without']]},
{note:'The restore test **without** the keystore is as important as the one with it. It proves the encryption works and the backups are protected.'}],
src:[['Transparent Data Encryption',AS]]};

})();
