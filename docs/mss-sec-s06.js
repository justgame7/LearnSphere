/* LearnSphere - SQL Server Security & Compliance, Section 06: Always Encrypted.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const prot=M.dg(700,200,[
[10,20,200,70,'Application|driver encrypts and|decrypts, holds keys',2],[250,20,200,70,'SQL Server|sees only ciphertext|cannot decrypt',0],[490,20,200,70,'DBA and admin|can run the server|cannot read the data',0],
[10,110,680,70,'Protects data in use and at rest from people with server access. TDE does not.',0]],
[[210,55,250,55],[450,55,490,55]]);

const keys=M.dg(700,200,[
[10,25,200,70,'Column master key CMK|stored outside SQL Server|certificate store or Key Vault',2],[250,25,200,70,'Column encryption key CEK|in the database, stored|encrypted by the CMK',0],[490,25,200,70,'Encrypted column|ciphertext with CEK',2],
[10,115,680,70,'The database holds only the encrypted CEK and the CMK location, never the CMK itself',0]],
[[210,60,250,60],[450,60,490,60]]);

const typ=M.dg(700,190,[
[10,20,330,150,'Deterministic',1],[25,55,300,30,'Same value gives same ciphertext',2],[25,95,300,30,'Equality, joins, grouping, index',0],[25,135,300,28,'Patterns visible, less secure',0],
[360,20,330,150,'Randomized',1],[375,55,300,30,'Same value, different ciphertext',2],[375,95,300,30,'No search, no join',0],[375,135,300,28,'Most secure',0]],
[]);

const enc=M.dg(700,170,[
[10,25,200,70,'Client driver|sends encrypted|parameters',0],[250,25,200,70,'Secure enclave|protected memory|inside the server',2],[490,25,200,70,'Allows|range, LIKE, sort,|in-place encryption',0],
[10,115,680,40,'The enclave is attested before the client sends it keys',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: What it protects ---------- */
L['mss-sec:5:0']={blocks:[
{p:'**Always Encrypted** encrypts sensitive **columns** in the client driver. SQL Server stores and processes only ciphertext. Even a sysadmin cannot read the values.'},
{svg:prot},
{t:[['Feature','Protects','Against whom'],
['**TLS**','Data in transit','Network attackers'],
['**TDE**','Data files and backups','File and backup thieves'],
['**Always Encrypted**','Specific columns, in use and at rest','Anyone with server access, including DBAs'],
['**Dynamic Data Masking**','Display of values','Casual viewing, not an attacker']]},
{h:'Good fits'},
{ul:['Highly sensitive columns: **national IDs**, **card numbers**, **health data**.','Environments where **DBAs or cloud operators** should not see the data.','Compliance rules that require **separation** of data owners and administrators.']},
{note:'The application must use a supported driver and the right connection setting. Always Encrypted changes how queries are written and what they can do.'}],
src:[['Always Encrypted',M.RD+'security/encryption/always-encrypted-database-engine'],['Always Encrypted overview',M.RD+'security/encryption/always-encrypted-database-engine']]};

/* ---------- 1: CMK and CEK ---------- */
L['mss-sec:5:1']={blocks:[
{p:'Two kinds of keys work together. The **column master key (CMK)** is kept **outside** the database. The **column encryption key (CEK)** is stored in the database, encrypted by the CMK.'},
{svg:keys},
{t:[['Key','Stored','Purpose'],
['**CMK**','Windows certificate store, Azure Key Vault, HSM','Protects CEKs. Never in SQL Server.'],
['**CEK**','In the database, encrypted value only','Encrypts column data']]},
{code:`-- Metadata only: the keys appear in catalog views
SELECT name, key_store_provider_name, key_path FROM sys.column_master_keys;
SELECT cek.name, cekv.encrypted_value
FROM   sys.column_encryption_keys cek
JOIN   sys.column_encryption_key_values cekv ON cekv.column_encryption_key_id = cek.column_encryption_key_id;`},
{h:'Key management rules'},
{ul:['Create keys with **SSMS wizard or PowerShell**, so the CMK is generated outside SQL Server.','Give the **application** access to the CMK, not the DBA.','**Rotate the CMK** by re-encrypting the CEK with a new CMK, without re-encrypting the data.','**Back up** the CMK. Lose it and the data is gone.']}],
src:[['Always Encrypted key management',M.RD+'security/encryption/overview-of-key-management-for-always-encrypted'],['Create and store column master keys',M.RD+'security/encryption/create-and-store-column-master-keys-always-encrypted']]};

/* ---------- 2: Deterministic vs randomized ---------- */
L['mss-sec:5:2']={blocks:[
{p:'The **encryption type** is a trade-off between security and what you can do with the column.'},
{svg:typ},
{code:`CREATE TABLE sales.Customers (
  CustomerID int IDENTITY PRIMARY KEY,
  Name nvarchar(100) NOT NULL,
  NationalID char(11) COLLATE Latin1_General_BIN2
    ENCRYPTED WITH (COLUMN_ENCRYPTION_KEY = CEK_Customers,
                    ENCRYPTION_TYPE = DETERMINISTIC,
                    ALGORITHM = 'AEAD_AES_256_CBC_HMAC_SHA_256') NOT NULL,
  Notes nvarchar(500)
    ENCRYPTED WITH (COLUMN_ENCRYPTION_KEY = CEK_Customers,
                    ENCRYPTION_TYPE = RANDOMIZED,
                    ALGORITHM = 'AEAD_AES_256_CBC_HMAC_SHA_256') NULL
);`},
{t:[['Operation','Deterministic','Randomized'],
['Equality `=`, `IN`','Yes','No'],
['`JOIN`, `GROUP BY`, `DISTINCT`','Yes','No'],
['Indexing','Yes','No'],
['`LIKE`, range, sort','No (without enclaves)','No (without enclaves)']]},
{note:'Character columns using deterministic encryption need a BIN2 collation. Applications must connect with Column Encryption Setting = Enabled so the driver encrypts parameters and decrypts results.'}],
src:[['Always Encrypted: select encryption type',M.RD+'security/encryption/always-encrypted-database-engine'],['Develop applications using Always Encrypted',M.RD+'security/encryption/always-encrypted-client-development']]};

/* ---------- 3: Secure enclaves ---------- */
L['mss-sec:5:3']={blocks:[
{p:'Basic Always Encrypted cannot compute on encrypted data inside the server. **Secure enclaves** (SQL Server 2019 and later) add a **protected region of memory** where the engine can decrypt and compute, invisible to the operating system and the DBA.'},
{svg:enc},
{h:'What enclaves add'},
{ul:['**Rich queries**: `LIKE`, range comparisons, sorting on encrypted columns.','**In-place encryption**: encrypt or rotate keys on the server without moving data to the client.','**Indexes** on randomized columns, with enclave-enabled keys.']},
{h:'Requirements and cautions'},
{t:[['Item','Notes'],
['**Enclave type**','Virtualization-based security (VBS) in Windows, others on specific hardware'],
['**Attestation**','The client checks that the enclave is genuine (Host Guardian Service or another provider)'],
['**Keys**','Created enclave-enabled (`ENCLAVE_COMPUTATIONS`)'],
['**Limits**','Some features and query shapes are not supported: check the feature list']]},
{note:'Enclaves reduce, not remove, trust in the environment. They need attestation and operational discipline. Pilot with a small data set first.'}],
src:[['Always Encrypted with secure enclaves',M.RD+'security/encryption/always-encrypted-enclaves'],['Plan for attestation',M.RD+'security/encryption/always-encrypted-enclaves-plan-for-vbs']]};

})();
