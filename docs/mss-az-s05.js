/* LearnSphere - SQL Server Azure SQL & Hybrid, Section 05: Security in Azure SQL.
   Lectures 0-3 are core, 4-5 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const ent=M.dg(700,200,[
[10,20,170,70,'User or app|signs in to Entra ID',0],[210,20,170,70,'Token issued|MFA, Conditional|Access',2],[410,20,130,70,'Azure SQL|validates token',0],[570,20,120,70,'Mapped to|database user|or role',0],
[10,115,680,70,'Prefer Entra-only authentication, groups for access, and managed identities for applications',0]],
[[180,55,210,55],[380,55,410,55],[540,55,570,55]]);

const net=M.dg(700,220,[
[10,15,680,190,'Network access',1],
[30,55,190,60,'Public endpoint|server firewall rules|IP and VNet rules',0],[255,55,190,60,'Private endpoint|private IP in your VNet|via Private Link',2],[480,55,190,60,'Deny public access|only private paths',2],
[30,135,640,60,'Choose private endpoints for production data, and keep public access closed unless there is a clear need',0]],
[]);

const enc=M.dg(700,200,[
[10,15,215,170,'In transit',1],[25,50,185,30,'TLS 1.2 or higher',2],[25,90,185,30,'Enforced by the service',0],[25,130,185,30,'Validate certificates',0],
[245,15,215,170,'At rest',1],[260,50,185,30,'TDE on by default',2],[260,90,185,30,'Service-managed key',0],[260,130,185,30,'Or customer-managed key',0],
[480,15,210,170,'In use',1],[495,50,180,30,'Always Encrypted',2],[495,90,180,30,'Secure enclaves',0],[495,130,180,30,'Ledger',0]],
[]);

const aud=M.dg(700,190,[
[10,25,200,70,'Auditing|server or database level|to Storage, Log Analytics,|Event Hubs',2],[250,25,200,70,'Defender for SQL|vulnerability assessment|threat protection',0],[490,25,200,70,'Alerts and review|ownership and|response',0],
[10,115,680,60,'Auditing records who did what. Threat protection detects suspicious activity such as injection attempts.',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: Entra ID ---------- */
L['mss-az:4:0']={blocks:[
{p:'**Microsoft Entra ID** is the identity platform for Azure. Azure SQL uses it for sign-in, MFA and central control of who can connect.'},
{svg:ent},
{code:`-- Create a contained user for an Entra group (run while connected as the Entra admin)
CREATE USER [SQL Readers] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [SQL Readers];

-- Managed identity of an application
CREATE USER [app-orders-prod] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [app-orders-prod];
ALTER ROLE db_datawriter ADD MEMBER [app-orders-prod];`},
{h:'Good practice'},
{ul:['Set an **Entra admin** group on the server and consider **Entra-only** authentication.','Give access to **groups**, not individuals.','Use **managed identities** so applications have no password.','Use **MFA** and Conditional Access for administrators.','Keep a **break-glass** account, protected and monitored.']}],
src:[['Entra authentication for Azure SQL','https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-aad-overview'],['Entra-only authentication','https://learn.microsoft.com/en-us/azure/azure-sql/database/authentication-azure-ad-only-authentication']]};

/* ---------- 1: Private endpoints and firewall ---------- */
L['mss-az:4:1']={blocks:[
{p:'By default an Azure SQL logical server has a **public endpoint** protected by a **firewall**. For production data, move to **private connectivity**.'},
{svg:net},
{t:[['Control','Meaning'],
['**Server-level firewall rules**','Allow IP ranges to the whole server'],
['**Database-level firewall rules**','Allow IP ranges to one database'],
['**Virtual network rules**','Allow subnets via service endpoints'],
['**Private endpoint**','Private IP for the server in your VNet, via Private Link'],
['**Deny public network access**','Closes the public endpoint entirely'],
['**Allow Azure services**','Wide: use with care']]},
{code:`az sql server update --name sql-sales-prod --resource-group rg-sales --enable-public-network false
az network private-endpoint create --name pe-sql-sales --resource-group rg-sales \\
   --vnet-name vnet-app --subnet snet-data --private-connection-resource-id <server-resource-id> \\
   --group-id sqlServer --connection-name sql-sales-conn`},
{note:'With private endpoints, DNS must resolve the server name to the private IP. Plan private DNS zones, or connections will fail.'}],
src:[['Private Link for Azure SQL','https://learn.microsoft.com/en-us/azure/azure-sql/database/private-endpoint-overview'],['Server firewall rules','https://learn.microsoft.com/en-us/azure/azure-sql/database/firewall-configure']]};

/* ---------- 2: Encryption ---------- */
L['mss-az:4:2']={blocks:[
{p:'Azure SQL encrypts **in transit**, **at rest** and, with options, **in use**. Know the defaults and when to take control of keys.'},
{svg:enc},
{h:'TDE and keys'},
{t:[['Option','Who holds the key'],
['**Service-managed key** (default)','Microsoft manages and rotates it'],
['**Customer-managed key (BYOK)**','Your key in Azure Key Vault, you control rotation and access']]},
{ul:['With a **customer-managed key**, revoking access to the key makes the database inaccessible: protect and monitor the key vault.','Use **soft delete and purge protection** on Key Vault.','**Always Encrypted** protects columns from admins and the service itself.','Set **minimum TLS version** to 1.2 or higher on the server.']},
{code:`SELECT DB_NAME(database_id) AS db, encryption_state_desc, encryptor_type
FROM   sys.dm_database_encryption_keys;`}],
src:[['TDE for Azure SQL','https://learn.microsoft.com/en-us/azure/azure-sql/database/transparent-data-encryption-tde-overview'],['Customer-managed TDE','https://learn.microsoft.com/en-us/azure/azure-sql/database/transparent-data-encryption-byok-overview']]};

/* ---------- 3: Auditing and threat protection ---------- */
L['mss-az:4:3']={blocks:[
{p:'**Auditing** records events. **Microsoft Defender for SQL** adds vulnerability assessment and threat detection.'},
{svg:aud},
{h:'Auditing'},
{ul:['Enable at **server level** so every database is covered.','Send to **Log Analytics** for queries and alerts, a **storage account** for retention, or **Event Hubs** for SIEM.','Choose **action groups** that match your policy: logins, failures, permission changes, data access.']},
{h:'Defender for SQL'},
{t:[['Capability','What it does'],
['**Vulnerability assessment**','Scans configuration against a rule set and reports findings'],
['**Advanced threat protection**','Alerts on SQL injection, unusual access, brute force']]},
{note:'Alerts need an owner and a response procedure, as in any monitoring design. Route them to the people who can act.'}],
src:[['Auditing for Azure SQL','https://learn.microsoft.com/en-us/azure/azure-sql/database/auditing-overview'],['Microsoft Defender for SQL','https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-sql-introduction']]};

})();
