/* LearnSphere - Oracle Core DBA, Section 06: Oracle Net Services.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const net=O.dg(700,250,[
[10,90,130,70,'Client|connect identifier|name or EZConnect',0],
[190,90,130,70,'Listener|listens on port 1521',2],
[370,10,320,230,'Database server',1],
[390,45,280,70,'Instance|LREG registers services|with the listener',2],
[390,135,280,90,'Services|ORCL (CDB)|PDB1 (a PDB)|app_svc (your service)',0]],
[[140,125,190,125],[320,115,390,80],[540,115,540,135],[390,80,320,105]]);

const names=O.dg(700,130,[
[10,35,120,60,'Connect|identifier',0],[170,35,140,60,'Name resolution|tnsnames.ora|or EZConnect',2],[350,35,140,60,'Connect|descriptor|host, port, service',0],[530,35,160,60,'Listener|finds the service|and connects you',2]],
[[130,65,170,65],[310,65,350,65],[490,65,530,65]]);

/* ---------- 0: Architecture ---------- */
L['ora-core:5:0']={blocks:[
{p:'**Oracle Net Services** is the layer that connects clients to the database over a network. Three ideas explain it: a **listener** waits for requests, **services** are the names clients ask for, and a **connect descriptor** says how to reach them.'},
{svg:net},
{h:'The parts'},
{t:[['Part','What it is'],
['**Listener**','A process that listens on a port (default 1521) and hands connections to the database'],
['**Service**','A named entry point to a database or PDB. Clients connect to services.'],
['**Connect identifier**','What the user types: a net service name or an EZConnect string'],
['**Connect descriptor**','The full description of the host, port and service'],
['**Net service name**','A short alias for a connect descriptor, stored in `tnsnames.ora`']]},
{h:'A connect descriptor'},
{code:`(DESCRIPTION =
  (ADDRESS = (PROTOCOL = TCP)(HOST = dbserver)(PORT = 1521))
  (CONNECT_DATA = (SERVICE_NAME = pdb1.example.com))
)`},
{h:'How a connection happens'},
{flow:['The client resolves the connect identifier into a descriptor','The client contacts the listener at host and port','The listener checks that it knows the service','It creates a server process (or hands over to a dispatcher)','The client talks directly to its server process']},
{h:'Where the configuration files are'},
{t:[['File','Side','Purpose'],
['`listener.ora`','Server','Listener addresses and settings'],
['`tnsnames.ora`','Client','Aliases for connect descriptors'],
['`sqlnet.ora`','Both','Name resolution order, timeouts, security']]},
{p:'They live in `$ORACLE_HOME/network/admin`, or in the folder named by the `TNS_ADMIN` environment variable. With a read-only Oracle Home they live under the Oracle Base instead.'},
{note:'After the connection starts, the listener is no longer involved. Stopping the listener does not disconnect existing sessions, but nobody new can connect.'}],
src:[['Net Services Administrator Guide',D+'netag/'],['Understanding Oracle Net',D+'netag/introducing-oracle-net-services.html']]};

/* ---------- 1: listener.ora ---------- */
L['ora-core:5:1']={blocks:[
{p:'The listener is controlled with the **lsnrctl** command. Its settings are in `listener.ora`, but in most cases you need very little there, because instances **register themselves**.'},
{h:'A typical listener.ora'},
{code:`LISTENER =
  (DESCRIPTION_LIST =
    (DESCRIPTION =
      (ADDRESS = (PROTOCOL = TCP)(HOST = dbserver)(PORT = 1521))
    )
  )

ADR_BASE_LISTENER = /u01/app/oracle`},
{p:'If the file is missing, the listener starts on port 1521 using defaults.'},
{h:'Dynamic and static registration'},
{t:[['','Dynamic registration','Static registration'],
['**How**','The instance (LREG process) tells the listener which services it offers','Services are listed by hand in `SID_LIST_LISTENER`'],
['**When the instance is down**','Service disappears (honest status)','Entry stays, status UNKNOWN'],
['**Used for**','Normal connections','Tools that must connect while the instance is down, such as some Data Guard and RMAN tasks'],
['**Effort**','None','You maintain the file']]},
{p:'Dynamic registration happens at startup and every minute or so. To register now, run `ALTER SYSTEM REGISTER;`.'},
{h:'lsnrctl commands'},
{t:[['Command','Use'],
['`lsnrctl start`','Start the listener'],
['`lsnrctl stop`','Stop it (existing sessions continue)'],
['`lsnrctl status`','Is it running, which addresses, how long, which log'],
['`lsnrctl services`','Every service and its handlers, with READY or BLOCKED'],
['`lsnrctl reload`','Re-read `listener.ora` without a stop'],
['`lsnrctl status LISTENER2`','Work with a named listener']]},
{code:`lsnrctl status

Services Summary...
Service "FREE" has 1 instance(s).
  Instance "FREE", status READY, has 1 handler(s) for this service...
Service "FREEPDB1" has 1 instance(s).
  Instance "FREE", status READY, has 1 handler(s) for this service...`},
{p:'**READY** means the instance accepts connections. **BLOCKED** means it is up but not accepting (restricted mode or not open). **UNKNOWN** means a static entry with no live instance behind it.'},
{h:'Where the listener log is'},
{code:`# text log
$ORACLE_BASE/diag/tnslsnr/<host>/<listener>/trace/listener.log`},
{note:'Which instance does the listener talk to? Check the setting `LOCAL_LISTENER` in the database. If it points to the wrong host or port, the instance registers with a listener that nobody connects to.'}],
src:[['Configuring and administering the listener',D+'netag/configuring-and-administering-the-listener.html']]};

/* ---------- 2: tnsnames and sqlnet ---------- */
L['ora-core:5:2']={blocks:[
{p:'**tnsnames.ora** gives short names to long connect descriptors. **sqlnet.ora** decides how names are resolved and sets security and timeouts.'},
{svg:names},
{h:'An entry in tnsnames.ora'},
{code:`PDB1 =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = dbserver)(PORT = 1521))
    (CONNECT_DATA =
      (SERVER = DEDICATED)
      (SERVICE_NAME = pdb1.example.com)
    )
  )

-- Use it
sqlplus app_user@PDB1`},
{h:'Where Oracle looks for tnsnames.ora'},
{flow:['The folder in the TNS_ADMIN variable','The .tnsnames.ora file in your home folder','/etc/tnsnames.ora','$ORACLE_HOME/network/admin']},
{p:'The first file found is used. A stray `TNS_ADMIN` is the most common reason an entry that exists is reported as missing.'},
{h:'Useful sqlnet.ora settings'},
{t:[['Setting','Effect'],
['`NAMES.DIRECTORY_PATH = (TNSNAMES, EZCONNECT)`','Order of name resolution methods'],
['`SQLNET.EXPIRE_TIME = 10`','Probe idle connections every 10 minutes to detect dead clients'],
['`SQLNET.INBOUND_CONNECT_TIMEOUT = 60`','Seconds a client has to finish login (server side)'],
['`SQLNET.OUTBOUND_CONNECT_TIMEOUT = 20`','How long the client waits to connect'],
['`TCP.VALIDNODE_CHECKING = YES`','Allow connections only from listed hosts (see lecture 6)']]},
{h:'Test a name'},
{code:`tnsping PDB1
-- OK (20 msec) means the name resolves and the listener answered
-- It does not test the password or that the service is registered`},
{note:'Keep a single, central tnsnames.ora and point TNS_ADMIN to it on every client. It prevents ten slightly different copies.'}],
src:[['Configuring naming methods',D+'netag/configuring-naming-methods.html'],['sqlnet.ora parameters',D+'netrf/']]};

/* ---------- 3: EZConnect and service naming ---------- */
L['ora-core:5:3']={blocks:[
{p:'Clients can reach a service **without any file** (EZConnect) or **through a name** (tnsnames). Either way, the target is always a **service name**.'},
{h:'EZConnect'},
{t:[['Form','Example'],
['Basic','`dbserver:1521/pdb1.example.com`'],
['With slashes','`//dbserver:1521/pdb1.example.com`'],
['With options (EZConnect Plus)','`dbserver:1521/pdb1.example.com?connect_timeout=10&transport_connect_timeout=5`']]},
{code:`sqlplus app_user@//dbserver:1521/pdb1.example.com`},
{h:'Which services exist?'},
{code:`SELECT name, pdb, network_name FROM v$services ORDER BY name;

lsnrctl services`},
{t:[['Service','Created by','Points to'],
['**Default CDB service**','Oracle (named after `DB_UNIQUE_NAME`)','The root container'],
['**PDB service**','Oracle (named after the PDB)','That PDB'],
['**Your own service**','You, for an application','A PDB, with settings for that app']]},
{h:'Create your own service'},
{p:'A service per application lets you move, monitor and control it separately from the others.'},
{code:`ALTER SESSION SET CONTAINER = FREEPDB1;

BEGIN
  DBMS_SERVICE.CREATE_SERVICE(service_name => 'app_svc', network_name => 'app_svc');
  DBMS_SERVICE.START_SERVICE('app_svc');
END;
/

SELECT name FROM v$services;`},
{note:'In a plain single-instance database a service made with DBMS_SERVICE is not restarted automatically after a restart. Start it again from a startup trigger, or manage it with srvctl when you use Oracle Restart or Grid Infrastructure.'},
{flow:['Application connects to its own service name','Listener routes it to the right PDB','DBA can monitor and limit that service alone']}],
src:[['Services in a single instance',O.AD+'managing-an-oracle-database-instance.html'],['DBMS_SERVICE',D+'arpls/DBMS_SERVICE.html']]};

/* ---------- 4: Dedicated vs shared ---------- */
L['ora-core:5:4']={blocks:[
{p:'Section 3 introduced dedicated and shared server processes. This lecture shows how to **configure** them for a client or the whole database.'},
{h:'The client chooses'},
{code:`ORCL_DED =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = dbserver)(PORT = 1521))
    (CONNECT_DATA = (SERVER = DEDICATED)(SERVICE_NAME = pdb1.example.com))
  )

ORCL_SHR =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = dbserver)(PORT = 1521))
    (CONNECT_DATA = (SERVER = SHARED)(SERVICE_NAME = pdb1.example.com))
  )`},
{t:[['SERVER value','Result'],
['`DEDICATED`','Always gets its own server process, even when shared server is on'],
['`SHARED`','Uses a dispatcher. Fails if shared server is not configured.'],
['Not given','Shared if the database offers it, otherwise dedicated']]},
{h:'Enable shared server on the database'},
{code:`ALTER SYSTEM SET shared_servers = 5;
ALTER SYSTEM SET max_shared_servers = 20;
ALTER SYSTEM SET dispatchers = '(PROTOCOL=TCP)(DISPATCHERS=2)';

SELECT name, status, messages FROM v$dispatcher;
SELECT name, status, requests FROM v$shared_server;`},
{flow:['Set SHARED_SERVERS and DISPATCHERS','Dispatchers register with the listener','Shared clients connect to a dispatcher','Work is queued to shared servers','Check V$DISPATCHER and V$SHARED_SERVER for load']},
{h:'When to use which'},
{t:[['Situation','Choose'],
['Normal OLTP and reporting','Dedicated'],
['DBA sessions, batch jobs, backups','**Always dedicated**'],
['Thousands of mostly idle connections','Shared server, or an application connection pool'],
['Long-running queries','Dedicated: they would block a shared server']]},
{note:'Many modern applications use a connection pool, which gives the same saving as shared server with less risk. Check with the application team before you change the server mode.'}],
src:[['Configuring a database for shared server',D+'admin/configuring-a-database-for-shared-server.html'],['V$DISPATCHER',O.RF+'V-DISPATCHER.html']]};

/* ---------- 5: Troubleshooting ---------- */
L['ora-core:5:5']={blocks:[
{p:'Most connection problems come from five errors. Each points at a different layer: the name, the listener, the service or the network.'},
{h:'The five errors'},
{t:[['Error','Meaning','Usual cause and fix'],
['**ORA-12154**','TNS: could not resolve the connect identifier','Name not in tnsnames.ora, wrong `TNS_ADMIN`, typo, or sqlnet.ora does not allow the method.'],
['**ORA-12541**','No listener','Listener not running, wrong host or port. Start it with `lsnrctl start`.'],
['**ORA-12514**','Listener does not know the requested service','Service not registered: database or PDB not open, wrong service name, wrong `LOCAL_LISTENER`. Try `ALTER SYSTEM REGISTER;`.'],
['**ORA-12170**','Connect timeout','Firewall, wrong IP or routing. Packets never arrive.'],
['**ORA-12505**','Listener does not know the SID','You used SID where a service name is needed.']]},
{h:'Work from the outside in'},
{flow:['Can I reach the host? ping or nc','Is something listening on the port? ss or nc','Does the name resolve? tnsping','Does the listener know the service? lsnrctl services','Is the PDB open and the service READY?','Then check credentials']},
{code:`# 1 and 2: host and port
ping dbserver
nc -zv dbserver 1521

# 3: name and listener
tnsping PDB1

# 4 and 5: on the server
lsnrctl status
lsnrctl services
SELECT name, open_mode FROM v$pdbs;
SHOW PARAMETER local_listener`},
{h:'Quick decision table'},
{t:[['What you see','Check first'],
['`tnsping` fails with TNS-03505','The name (tnsnames.ora, TNS_ADMIN)'],
['`tnsping` works, login says 12514','Is the service registered? PDB open?'],
['Login hangs, then 12170','Firewall or network path'],
['Works from the server, not from the client','Firewall, listener address (localhost vs hostname)']]},
{note:'tnsping only proves the name and listener work. A good result does not prove the service exists or the password is right.'}],
src:[['Troubleshooting Oracle Net',D+'netag/testing-connections.html'],['Database Error Messages',O.ERR]]};

/* ---------- 6: Securing the listener ---------- */
L['ora-core:5:6']={blocks:[
{p:'The listener is the front door of the database. A few settings reduce who can reach it and what they can do to it.'},
{h:'The main protections'},
{t:[['Protection','What it does','Where'],
['**Valid node checking**','Accepts connections only from approved hosts','`sqlnet.ora` on the server'],
['**Admin restrictions**','Blocks changes with `lsnrctl set` from outside','`listener.ora`'],
['**Firewall**','Limits who can reach the port at network level','OS or network'],
['**TLS**','Encrypts traffic and checks identities','Security sub-course'],
['**Log permissions**','Only the oracle user reads the listener log','OS']]},
{h:'Valid node checking'},
{code:`# sqlnet.ora on the database server
TCP.VALIDNODE_CHECKING = YES
TCP.INVITED_NODES = (10.0.0.11, 10.0.0.12, appserver1)
# or exclude specific hosts instead
# TCP.EXCLUDED_NODES = (10.0.9.9)`},
{p:'Restart or reload the listener after changing it. Only the listed hosts can open a connection. Everyone else is refused before they reach the database.'},
{h:'Admin restrictions'},
{code:`# listener.ora
ADMIN_RESTRICTIONS_LISTENER = ON`},
{p:'With this on, the `lsnrctl set` command cannot change running settings. You edit `listener.ora` and run `lsnrctl reload`. This prevents someone from altering logging or other settings on a live listener.'},
{h:'Checklist'},
{ul:['Never expose port 1521 to the internet.','Open the firewall only for application and admin hosts.','Keep the listener and database patched, since listener vulnerabilities are fixed in Release Updates.','Review `listener.log` for failed attempts and unknown hosts.','Plan TLS for traffic across untrusted networks.']},
{flow:['Network firewall limits the port','Valid node checking limits the hosts','Admin restrictions protect the listener settings','TLS protects data and identity','Database authentication checks the user']},
{note:'Each layer helps even when another fails. Do not rely on a single control.'}],
src:[['Securing the listener',D+'netag/'],['Valid node checking',D+'netrf/']]};

/* ---------- 7: Practical ---------- */
L['ora-core:5:7']={blocks:[
{p:'In this lab you create a **second listener**, register your database with both, and connect through your own service. Use a VM or run the commands inside the lab container.'},
{h:'Task 1: A second listener'},
{code:`# Add to listener.ora
LISTENER2 =
  (DESCRIPTION_LIST =
    (DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = 0.0.0.0)(PORT = 1522)))
  )

lsnrctl start LISTENER2
lsnrctl status LISTENER2`},
{h:'Task 2: Register with both listeners'},
{code:`ALTER SYSTEM SET local_listener =
 '(ADDRESS_LIST=(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1521))(ADDRESS=(PROTOCOL=TCP)(HOST=localhost)(PORT=1522)))'
 SCOPE = BOTH;
ALTER SYSTEM REGISTER;

lsnrctl services LISTENER2`},
{h:'Task 3: Your own service'},
{code:`ALTER SESSION SET CONTAINER = FREEPDB1;
EXEC DBMS_SERVICE.CREATE_SERVICE('lab_svc','lab_svc');
EXEC DBMS_SERVICE.START_SERVICE('lab_svc');

-- tnsnames.ora
LAB =
  (DESCRIPTION =
    (ADDRESS = (PROTOCOL = TCP)(HOST = localhost)(PORT = 1522))
    (CONNECT_DATA = (SERVICE_NAME = lab_svc))
  )

tnsping LAB
sqlplus system@LAB`},
{h:'Task 4: Break it and read the error'},
{flow:['Stop LISTENER2 and try the LAB name: expect ORA-12541','Start it again, then close the PDB and try again: expect ORA-12514','Open the PDB, run ALTER SYSTEM REGISTER and connect again']},
{h:'Check your results'},
{t:[['Check','Expected'],
['`lsnrctl services LISTENER2`','Shows FREEPDB1 and lab_svc as READY'],
['`tnsping LAB`','OK'],
['Login with listener stopped','ORA-12541'],
['Login with PDB closed','ORA-12514']]},
{note:'Change LOCAL_LISTENER back to the original value when you finish, so the lab stays tidy.'}],
src:[['Net Services Administrator Guide',D+'netag/']]};

})();
