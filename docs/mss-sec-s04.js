/* LearnSphere - SQL Server Security & Compliance, Section 04: Encryption in Transit.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const why=M.dg(700,170,[
[10,25,150,70,'Client|password and|queries',0],[200,25,200,70,'Network|can be sniffed|or altered',2],[440,25,140,70,'SQL Server',0],[610,25,80,70,'Data',0],
[10,115,680,40,'TLS encrypts the TDS stream and proves the server identity to the client',0]],
[[160,60,200,60],[400,60,440,60],[580,60,610,60]]);

const cert=M.dg(700,200,[
[10,15,680,170,'Certificate requirements',1],
[30,55,200,50,'Server Authentication|usage (EKU)',0],[250,55,200,50,'Subject or SAN matches|the FQDN clients use',2],[470,55,200,50,'Trusted by clients|via CA chain',2],
[30,125,200,50,'Valid dates,|not expired',0],[250,125,200,50,'Private key readable|by the service account',2],[470,125,200,50,'Strong key and|SHA-2 signature',0]],
[]);

const force=M.dg(700,170,[
[10,25,200,70,'Server: Force Encryption|all connections must|use TLS',2],[250,25,200,70,'Client: Encrypt = True|validate the certificate|TrustServerCertificate = False',2],[490,25,200,70,'Strict (TDS 8.0)|TLS first, like HTTPS|SQL Server 2022',0],
[10,115,680,40,'Encrypt on both sides, and do not trust a certificate you did not validate',0]],
[]);

const tr=M.dg(700,150,[
[10,25,130,70,'Check the|error log for|certificate load',0],[170,25,130,70,'Check dates,|name and key|access',2],[330,25,130,70,'Check TLS|versions and|ciphers',0],[490,25,200,70,'Check client trust,|chain and SAN|then retest',2]],
[[140,60,170,60],[300,60,330,60],[460,60,490,60]]);

/* ---------- 0: Why encrypt ---------- */
L['mss-sec:3:0']={blocks:[
{p:'Without **TLS**, a user name, password, queries and results cross the network in readable form on a path you may not control. TLS gives **confidentiality**, **integrity** and **server identity**.'},
{svg:why},
{h:'What it protects against'},
{t:[['Threat','Effect of TLS'],
['**Sniffing** on the network','Traffic is unreadable'],
['**Man in the middle**','Client validates the server certificate'],
['**Tampering**','Changes are detected'],
['**Credential capture**','SQL login passwords are encrypted in transit']]},
{h:'Check a connection'},
{code:`-- Is my connection encrypted?
SELECT session_id, encrypt_option, auth_scheme, net_transport, client_net_address
FROM   sys.dm_exec_connections
WHERE  session_id = @@SPID;`},
{note:'SQL Server can encrypt the login packet even without a certificate, using a self-signed one. That does not protect against man-in-the-middle. Use a proper certificate and validate it.'}],
src:[['Encrypt connections to SQL Server',M.DE+'configure-windows/configure-sql-server-encryption'],['Connect with encryption (TDS 8.0)',M.DE+'configure-windows/manage-certificates']]};

/* ---------- 1: Certificates ---------- */
L['mss-sec:3:1']={blocks:[
{p:'The server needs a **certificate** that clients trust. Without a good one, you end up trusting any certificate, which defeats the purpose.'},
{svg:cert},
{flow:['Request a certificate from your CA with the server FQDN in the subject or SAN','Install it in the Local Computer Personal store','Grant the SQL Server service account read access to the private key','In Configuration Manager, open the instance Properties, Certificate tab, pick it','Restart the instance','Check the error log for the load message']},
{code:`-- Certificate load message in the error log
EXEC sp_readerrorlog 0, 1, 'certificate';

-- Windows: list candidate certificates (PowerShell, run on the server)
-- Get-ChildItem Cert:\\LocalMachine\\My | Where-Object { $_.EnhancedKeyUsageList.FriendlyName -contains 'Server Authentication' }`},
{h:'Common requirements'},
{ul:['**Server Authentication** extended key usage.','Subject or SAN equal to the **name clients use** (and for clusters or AGs, the listener name too).','**Not expired**, and strong algorithms.','**Renewal** tracked: an expired certificate breaks encrypted connections.']},
{note:'Add the certificate expiry date to your monitoring. A forgotten expiry is a common cause of sudden connection failures.'}],
src:[['Configure SQL Server Database Engine for encrypting connections',M.DE+'configure-windows/configure-sql-server-encryption'],['Certificate requirements',M.DE+'configure-windows/certificate-requirements']]};

/* ---------- 2: Forcing encryption ---------- */
L['mss-sec:3:2']={blocks:[
{p:'Once a good certificate is in place, you can **require** encryption on the server and ask for it on the client.'},
{svg:force},
{h:'Server side'},
{ul:['Configuration Manager, **Protocols for MSSQLSERVER**, Properties, **Force Encryption = Yes**.','SQL Server 2022: **Force Strict Encryption** requires TDS 8.0 clients, and is the most protective mode.','Restart the service after the change.']},
{h:'Client side'},
{code:`# sqlcmd / connection string
Server=SQLPROD01;Database=SalesDB;Encrypt=True;TrustServerCertificate=False;Authentication=...;
# Strict mode (TDS 8.0, new drivers)
Encrypt=Strict;`},
{t:[['Client setting','Meaning'],
['`Encrypt=False`','Only login is encrypted if the server asks'],
['`Encrypt=True`','Encrypt the connection'],
['`Encrypt=Strict`','TLS first (TDS 8.0)'],
['`TrustServerCertificate=True`','Do not validate the certificate (lab only)']]},
{note:'Newer drivers default to Encrypt=True. Old applications may break after you force encryption, so test connection strings and drivers first.'}],
src:[['Connect to SQL Server with strict encryption',M.DE+'configure-windows/connect-with-strict-encryption'],['Encrypt connections',M.DE+'configure-windows/configure-sql-server-encryption']]};

/* ---------- 3: Troubleshooting ---------- */
L['mss-sec:3:3']={blocks:[
{p:'TLS failures show as vague messages such as **certificate chain was issued by an authority that is not trusted** or **SSL provider: no credentials**. Follow the path in order.'},
{svg:tr},
{t:[['Symptom','Likely cause'],
['**Certificate chain not trusted**','Client does not trust the CA or server uses a self-signed certificate'],
['**The target principal name is incorrect**','Name used by client not in certificate subject or SAN'],
['**Instance did not load certificate**','Wrong store, missing EKU, no private key permission'],
['**Handshake failed, no common protocol**','TLS version or cipher mismatch'],
['**Fails after renewal**','Old thumbprint still configured']]},
{code:`EXEC sp_readerrorlog 0, 1, 'certificate';
EXEC sp_readerrorlog 0, 1, 'encryption';

SELECT DISTINCT encrypt_option FROM sys.dm_exec_connections;`},
{h:'Checks'},
{ul:['**Server**: error log, certificate dates, EKU, private key access.','**Client**: does it trust the CA, does it use the right name, driver version?','**TLS**: TLS 1.2 or later enabled on both sides, old protocols disabled.','**Time**: clock drift can make a valid certificate look expired.']}],
src:[['Troubleshoot TLS and certificate issues','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/connect/tls-1-2-support-microsoft-sql-server'],['Encrypt connections',M.DE+'configure-windows/configure-sql-server-encryption']]};

})();
