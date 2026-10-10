/* LearnSphere - Security, Section 04: Network Security & Encryption in Transit.
   Lectures 0-5 are core, 6+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';
const NET=O.D+'netrf/';

/* ---------- diagrams ---------- */
const tls=O.dg(700,190,[
[10,50,140,90,'Client|wallet with|trusted CA',0],
[210,50,130,90,'TLS handshake|certificate check|session key',2],
[400,50,140,90,'Listener port|TCPS 2484|(not 1521)',0],
[590,50,100,90,'Database',0]],
[[150,95,210,95],[340,95,400,95],[540,95,590,95]]);

const zones=O.dg(700,210,[
[10,10,200,190,'Untrusted',1],[30,60,160,40,'Internet, users',0],
[250,10,200,190,'DMZ',1],[270,60,160,40,'Web or app tier',0],[270,115,160,40,'Connection Manager',2],
[490,10,200,190,'Data zone',1],[510,60,160,40,'Database listener',0],[510,115,160,40,'Database',2]],
[[190,80,270,80],[430,135,510,135]]);

/* ---------- 0: Native encryption ---------- */
L['ora-sec:3:0']={blocks:[
{p:'**Native Network Encryption** protects Oracle Net traffic with parameters in `sqlnet.ora`. It needs no certificates.'},
{code:`# sqlnet.ora on the SERVER
SQLNET.ENCRYPTION_SERVER = REQUIRED
SQLNET.ENCRYPTION_TYPES_SERVER = (AES256)
SQLNET.CRYPTO_CHECKSUM_SERVER = REQUIRED
SQLNET.CRYPTO_CHECKSUM_TYPES_SERVER = (SHA256)

# sqlnet.ora on the CLIENT
SQLNET.ENCRYPTION_CLIENT = REQUESTED
SQLNET.ENCRYPTION_TYPES_CLIENT = (AES256)`},
{t:[['Value','Meaning'],
['`REJECTED`','Will not use it'],
['`ACCEPTED`','Uses it if the other side asks (default)'],
['`REQUESTED`','Asks for it, but connects without it if the other side refuses'],
['`REQUIRED`','Connection fails if not used']]},
{h:'Two functions'},
{ul:['**Encryption:** the data is unreadable on the wire.','**Integrity (checksum):** changes in transit are detected.']},
{note:'Defaults are `ACCEPTED`, which means encrypted only if someone asked. Set `REQUIRED` on the server to be sure. Check your release, as defaults and support (AES, SHA) change.'}],
src:[['Network encryption',SG]]};

/* ---------- 1: TLS ---------- */
L['ora-sec:3:1']={blocks:[
{p:'**TLS** gives encryption **and** server (and optionally client) **authentication** through certificates. It uses a **wallet** on each side and the `TCPS` protocol.'},
{svg:tls},
{flow:['Create a wallet and a server certificate (signed by a CA)','Add the CA to the client wallet','Configure the listener with a TCPS endpoint','Configure `sqlnet.ora` with the wallet location','Connect with a TCPS connect string']},
{code:`-- listener.ora
LISTENER =
  (DESCRIPTION_LIST =
    (DESCRIPTION = (ADDRESS = (PROTOCOL = TCPS)(HOST = dbhost)(PORT = 2484))))
WALLET_LOCATION = (SOURCE = (METHOD = FILE)(METHOD_DATA = (DIRECTORY = /u01/wallet/server)))

-- client tnsnames.ora
ORCL_TLS = (DESCRIPTION = (ADDRESS = (PROTOCOL = TCPS)(HOST = dbhost)(PORT = 2484))
            (CONNECT_DATA = (SERVICE_NAME = orcl.example.com))
            (SECURITY = (SSL_SERVER_CERT_DN = "CN=dbhost.example.com")))`},
{t:[['Native encryption','TLS'],
['No certificates','Needs certificates and wallets'],
['Weaker authentication','Server and client authentication possible'],
['Easy to turn on','Needs certificate lifecycle management']]},
{note:'Plan **certificate renewal** from day one. An expired certificate stops all TLS connections at once.'}],
src:[['TLS configuration',SG]]};

/* ---------- 2: Listener hardening ---------- */
L['ora-sec:3:2']={blocks:[
{p:'The **listener** is the front door. Harden it.'},
{t:[['Item','Action'],
['**Admin access**','Listener is controlled only by the OS owner (local OS authentication). Remove remote admin.'],
['**`ADMIN_RESTRICTIONS_LISTENER`**','Set `ON` so changes need file edits and `RELOAD`'],
['**Valid node checking**','`TCP.VALIDNODE_CHECKING=YES`, `TCP.INVITED_NODES=(...)`'],
['**Default port**','Move away from 1521 if policy requires. It is not a strong control by itself.'],
['**Banner and version**','Do not expose more information than needed'],
['**Logging**','Keep listener logs and watch for connection spikes and errors'],
['**Dynamic registration**','Restrict with `REGISTRATION_INVITED_NODES_<listener>`'],
['**TCPS**','Add an encrypted endpoint and disable plain TCP if possible']]},
{code:`# listener.ora
ADMIN_RESTRICTIONS_LISTENER = ON

# sqlnet.ora
TCP.VALIDNODE_CHECKING = YES
TCP.INVITED_NODES = (10.1.2.10, 10.1.2.11, appserver1)
TCP.EXCLUDED_NODES = (10.9.9.9)`},
{note:'Valid node checking is a basic list. For real network control, use firewalls and network zones. It is a second layer, not a replacement.'}],
src:[['Listener security',O.D+'netag/']]};

/* ---------- 3: Firewalls, zones, CMAN ---------- */
L['ora-sec:3:3']={blocks:[
{p:'Put the database in a **protected zone**. Only the application tier reaches it.'},
{svg:zones},
{t:[['Control','What it does'],
['**Firewall**','Allows only needed ports and source addresses'],
['**Network zones**','Separate web, application and data tiers'],
['**Connection Manager (CMAN)**','Oracle proxy that filters by rules (source, service) and can multiplex'],
['**Private endpoints (cloud)**','No public address for the database'],
['**Bastion / jump host**','Administrators reach servers through one audited point']]},
{h:'Rules of thumb'},
{ul:['No direct internet access to a database listener.','Administrators connect through a bastion or VPN, with MFA.','Separate production and non-production networks.']},
{note:'Assume the application tier can be compromised. The data zone should allow only what that tier needs, on defined ports.'}],
src:[['Connection Manager',O.D+'netag/']]};

/* ---------- 4: Database links ---------- */
L['ora-sec:3:4']={blocks:[
{p:'**Database links** let one database use another. They are also a way to move data and credentials, so they need care.'},
{t:[['Risk','Control'],
['**Stored passwords** in `LINK$` readable by administrators','Use **connected user** links (`CONNECT TO CURRENT_USER`) or **wallets** where possible'],
['**Fixed user links** give everyone the same remote access','Create **private** links, not public, with a least-privilege remote account'],
['**Cleartext network traffic**','Use TLS or native encryption'],
['**Forgotten links to old systems**','Review `DBA_DB_LINKS` and drop unused links'],
['**Link to production from test**','Do not allow it. Copy-from-prod should drop links.']]},
{code:`SELECT owner, db_link, username, host, created FROM dba_db_links ORDER BY created;

-- link using the current user's identity
CREATE DATABASE LINK reports_link CONNECT TO CURRENT_USER USING \'REPORTS_TLS\';

-- global_names and open links limits
SHOW PARAMETER global_names
SHOW PARAMETER open_links`},
{note:'In 19c and later, check how link passwords are protected for your release. Treat every fixed-user link as a stored credential.'}],
src:[['Database links',SG]]};

/* ---------- 5: Practical ---------- */
L['ora-sec:3:5']={blocks:[
{p:'**Enforce encryption in transit** between a client and the database. You can do it with native encryption (quick) and then TLS (if you have the wallets).'},
{h:'Part 1: native encryption'},
{code:`# server sqlnet.ora
SQLNET.ENCRYPTION_SERVER = REQUIRED
SQLNET.ENCRYPTION_TYPES_SERVER = (AES256)
SQLNET.CRYPTO_CHECKSUM_SERVER = REQUIRED
SQLNET.CRYPTO_CHECKSUM_TYPES_SERVER = (SHA256)

-- verify from a client session
SELECT network_service_banner FROM v$session_connect_info
WHERE sid = SYS_CONTEXT(\'USERENV\',\'SID\');`},
{h:'Part 2: TLS'},
{flow:['Create server and client wallets and a test CA','Configure a TCPS listener endpoint','Create a TCPS service name','Connect and verify the banner shows TLS']},
{h:'Check your result'},
{t:[['Check','Expected'],
['`V$SESSION_CONNECT_INFO`','Lines show AES256 encryption and SHA256 checksum, or TLS'],
['Client without encryption config','Connection refused or negotiates (as the server requires)'],
['Network capture (optional)','No readable SQL text'],
['Certificate expiry date','Noted in the calendar']]},
{note:'Test with an old client too. A `REQUIRED` setting can break old drivers. Do the change in a maintenance window with a rollback.'}],
src:[['Network encryption',SG]]};

})();
