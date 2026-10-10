/* LearnSphere - Data Guard, Section 03: Preparing the Environment.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const lab=O.dg(700,230,[
[10,10,330,210,'Site A: host dbhost1',1],[30,45,290,50,'Primary database|DB_NAME=orcl  DB_UNIQUE_NAME=prod',2],[30,110,290,40,'Listener port 1521, service prod',0],[30,165,290,40,'Oracle home identical to standby',0],
[360,10,330,210,'Site B: host dbhost2',1],[380,45,290,50,'Standby database|DB_NAME=orcl  DB_UNIQUE_NAME=stby',2],[380,110,290,40,'Listener port 1521, service stby',0],[380,165,290,40,'Oracle home identical to primary',0]],
[[340,70,360,70]]);

/* ---------- 0: Lab architecture ---------- */
L['ora-dg:2:0']={blocks:[
{p:'Before you build a standby, plan the environment. A good plan avoids most of the problems that appear later.'},
{svg:lab},
{h:'Requirements'},
{t:[['Item','Requirement'],
['**Servers**','Two servers (VMs are fine) with the same OS family and the same endianness'],
['**Oracle software**','The **same release and patch level** on both, with the same database home path where possible'],
['**Network**','Fast, reliable link. Ports 1521 (or your listener port) open between hosts.'],
['**Time**','Clocks in step (chrony)'],
['**Storage**','Space for a full copy of the database, redo, archive logs and the Fast Recovery Area'],
['**Edition**','Enterprise Edition for Data Guard (and Active Data Guard if you want real-time query)']]},
{h:'Names used in this course'},
{t:[['Item','Primary','Standby'],
['Host','`dbhost1`','`dbhost2`'],
['`DB_NAME`','`orcl`','`orcl` (same)'],
['`DB_UNIQUE_NAME`','`prod`','`stby`'],
['Service / TNS alias','`prod`','`stby`'],
['SID (instance)','`orcl`','`orcl`']]},
{h:'Sizing the network'},
{p:'The link must carry the redo of the **peak** period. Measure your redo rate (`V$SYSSTAT`, `redo size`) and compare with the bandwidth.'},
{code:`SELECT ROUND(value/1024/1024) AS redo_mb_since_startup FROM v$sysstat WHERE name = 'redo size';
-- AWR or Statspack gives redo per second at peak`},
{flow:['Choose host names and IP addresses','Install the same Oracle software on both','Open the network and check name resolution','Plan storage for datafiles, redo and archive logs','Plan the names: DB_NAME and DB_UNIQUE_NAME']},
{note:'Same `DB_NAME`, different `DB_UNIQUE_NAME`. That rule is the core of Data Guard naming.'}],
src:[['Preparing for Data Guard',O.DG]]};

/* ---------- 1: Prerequisites ---------- */
L['ora-dg:2:1']={blocks:[
{p:'The primary must be in the right state before any standby can work. Check and set these items first.'},
{t:[['Setting','Why','Command'],
['**ARCHIVELOG mode**','Redo must be archived and shipped','`ALTER DATABASE ARCHIVELOG;` (in MOUNT)'],
['**FORCE LOGGING**','Every change must produce redo so the standby gets it','`ALTER DATABASE FORCE LOGGING;`'],
['**Flashback Database**','Needed to reinstate a failed primary and for fast-start failover','`ALTER DATABASE FLASHBACK ON;`'],
['**Password file**','Authentication for redo transport and administration','Same SYS password on both'],
['**`REMOTE_LOGIN_PASSWORDFILE`**','`EXCLUSIVE`','Parameter']]},
{code:`SELECT log_mode, force_logging, flashback_on FROM v$database;

ALTER DATABASE FORCE LOGGING;

-- Flashback needs a Fast Recovery Area
ALTER SYSTEM SET db_recovery_file_dest_size = 200G SCOPE = BOTH;
ALTER SYSTEM SET db_recovery_file_dest = '/u03/fast_recovery_area' SCOPE = BOTH;
ALTER SYSTEM SET db_flashback_retention_target = 1440 SCOPE = BOTH;   -- minutes
ALTER DATABASE FLASHBACK ON;

SHOW PARAMETER remote_login_passwordfile`},
{h:'Why flashback matters'},
{ul:['After a **failover**, the old primary can be **reinstated** as a standby with Flashback Database instead of a rebuild.','Fast-start failover requires flashback on both databases to reinstate automatically.']},
{flow:['Check the current state with V$DATABASE','Turn on FORCE LOGGING','Configure FRA and turn on Flashback','Confirm the password file and its parameter']},
{note:'Do these on the primary first. The standby is created from it, and inherits the settings.'}],
src:[['Preparing the primary',O.DG]]};

/* ---------- 2: SRLs and parameters ---------- */
L['ora-dg:2:2']={blocks:[
{p:'Set a small group of parameters and create standby redo logs. Many are already correct on a new database, so you check them and add what is missing.'},
{h:'Parameters on the primary'},
{t:[['Parameter','Value (example)','Purpose'],
['`DB_NAME`','`orcl`','Same on primary and standby'],
['`DB_UNIQUE_NAME`','`prod`','Different on each database'],
['`LOG_ARCHIVE_CONFIG`','`DG_CONFIG=(prod,stby)`','Lists the databases in the configuration'],
['`LOG_ARCHIVE_DEST_1`','`LOCATION=USE_DB_RECOVERY_FILE_DEST VALID_FOR=(ALL_LOGFILES,ALL_ROLES) DB_UNIQUE_NAME=prod`','Local archiving'],
['`LOG_ARCHIVE_DEST_2`','`SERVICE=stby ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=stby`','Redo transport to the standby'],
['`LOG_ARCHIVE_DEST_STATE_2`','`ENABLE`','Turn transport on'],
['`FAL_SERVER`','`stby`','Where to fetch missing logs after a role change'],
['`STANDBY_FILE_MANAGEMENT`','`AUTO`','New datafiles on the primary are created on the standby'],
['`DB_FILE_NAME_CONVERT` / `LOG_FILE_NAME_CONVERT`','Paths of primary and standby','Needed when folders differ (not with OMF or ASM)']]},
{code:`ALTER SYSTEM SET log_archive_config = 'DG_CONFIG=(prod,stby)' SCOPE = BOTH;
ALTER SYSTEM SET log_archive_dest_2 =
  'SERVICE=stby ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=stby' SCOPE = BOTH;
ALTER SYSTEM SET log_archive_dest_state_2 = ENABLE SCOPE = BOTH;
ALTER SYSTEM SET fal_server = 'stby' SCOPE = BOTH;
ALTER SYSTEM SET standby_file_management = AUTO SCOPE = BOTH;`},
{h:'Standby redo logs on the primary'},
{code:`SELECT group#, thread#, bytes/1024/1024 AS mb FROM v$log;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 11 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 12 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 13 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 14 SIZE 1G;`},
{note:'Create SRLs on the primary too. After a switchover the old primary becomes a standby and needs them. Creating them in advance saves a step later.'}],
src:[['Initialization parameters for Data Guard',O.DG]]};

/* ---------- 3: db_unique_name and log_archive_config ---------- */
L['ora-dg:2:3']={blocks:[
{p:'Two settings tell Oracle who the members of the configuration are and when each destination applies. They are the part of Data Guard that is most often set wrongly.'},
{h:'DB_UNIQUE_NAME'},
{t:[['Item','Meaning'],
['`DB_NAME`','The name stored in datafiles and control files. **Same** on every member.'],
['`DB_UNIQUE_NAME`','A unique name for each copy. Used in `LOG_ARCHIVE_CONFIG` and in the broker.'],
['Service name','Often equal to `DB_UNIQUE_NAME`. Used in TNS names.']]},
{h:'LOG_ARCHIVE_CONFIG'},
{code:`ALTER SYSTEM SET log_archive_config = 'DG_CONFIG=(prod,stby)';
-- Add a second standby later
ALTER SYSTEM SET log_archive_config = 'DG_CONFIG=(prod,stby,stby2)';`},
{h:'VALID_FOR: when a destination is used'},
{p:'`VALID_FOR=(log_type, role)` limits a destination to a type of redo and to a database role. This lets **one setting** work before and after a switchover.'},
{t:[['VALID_FOR','Meaning'],
['`(ONLINE_LOGFILES,PRIMARY_ROLE)`','Send online redo, only when this database is primary'],
['`(STANDBY_LOGFILES,STANDBY_ROLE)`','Archive received redo, only when this database is a standby'],
['`(ALL_LOGFILES,ALL_ROLES)`','Always (for local archiving)']]},
{h:'Both sides get symmetrical settings'},
{code:`-- On the standby: ready to become primary
ALTER SYSTEM SET log_archive_config = 'DG_CONFIG=(prod,stby)';
ALTER SYSTEM SET log_archive_dest_2 =
  'SERVICE=prod ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=prod';
ALTER SYSTEM SET fal_server = 'prod';`},
{flow:['Decide DB_UNIQUE_NAME for each member','Set DG_CONFIG on each member with all names','Define destinations with VALID_FOR on each member','After a switchover, the right destinations become active']},
{note:'When you use the Data Guard broker, it manages the destination attributes for you. Keep these settings simple, and let the broker control them after you enable it.'}],
src:[['Redo transport destinations',O.DG]]};

/* ---------- 4: Static listener ---------- */
L['ora-dg:2:4']={blocks:[
{p:'The standby instance may be **down or mounted** when you need to connect to it. Dynamic registration only works when an instance is running and open enough, so the standby needs a **static listener entry**. The broker needs another one.'},
{h:'listener.ora on the standby (and on the primary)'},
{code:`SID_LIST_LISTENER =
  (SID_LIST =
    (SID_DESC =
      (GLOBAL_DBNAME = stby)
      (ORACLE_HOME = /u01/app/oracle/product/19.0.0/dbhome_1)
      (SID_NAME = orcl))
    (SID_DESC =
      (GLOBAL_DBNAME = stby_DGMGRL)
      (ORACLE_HOME = /u01/app/oracle/product/19.0.0/dbhome_1)
      (SID_NAME = orcl))
  )`},
{t:[['Entry','Used for'],
['`GLOBAL_DBNAME=stby`','RMAN duplicate and connecting to the standby when it is not open'],
['`GLOBAL_DBNAME=<db_unique_name>_DGMGRL`','The broker uses it to restart the instance during switchover and failover']]},
{h:'tnsnames.ora on both servers'},
{code:`prod =
  (DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = dbhost1)(PORT = 1521))
    (CONNECT_DATA = (SERVICE_NAME = prod)))
stby =
  (DESCRIPTION = (ADDRESS = (PROTOCOL = TCP)(HOST = dbhost2)(PORT = 1521))
    (CONNECT_DATA = (SERVICE_NAME = stby)))`},
{h:'Test'},
{code:`lsnrctl reload
tnsping prod
tnsping stby
sqlplus sys@stby as sysdba          -- from the primary host`},
{flow:['Add static entries on the standby (and on the primary)','Create TNS aliases on both','Reload listeners','Test tnsping and a SYSDBA connection both ways']},
{note:'The _DGMGRL entry matters. Without it a broker-driven switchover can fail with ORA-12514 when the instance restarts.'}],
src:[['Net configuration for Data Guard',O.DG]]};

/* ---------- 5: Password file and wallet ---------- */
L['ora-dg:2:5']={blocks:[
{p:'The primary authenticates to the standby with the **SYS password** (or another administrative user). If the password file differs, redo transport fails with an authentication error.'},
{h:'Password file'},
{code:`# On the primary
scp $ORACLE_HOME/dbs/orapworcl dbhost2:$ORACLE_HOME/dbs/orapworcl

# If the file was created with a specific format, create the same way on the standby
orapwd file=$ORACLE_HOME/dbs/orapworcl password=<same SYS password> entries=10 format=12.2 force=y`},
{t:[['Point','Notes'],
['Same SYS password on both','Required for redo transport'],
['Copy rather than recreate when you can','Keeps other administrative users'],
['Later changes','Recent releases propagate password file changes with redo, so changes made on the primary reach the standby'],
['Use a dedicated user for redo transport','Optional: `SYSDG` or a named user with the privilege, instead of SYS']]},
{h:'Check authentication'},
{code:`sqlplus sys/<password>@stby as sysdba
SELECT username, sysdba, sysdg FROM v$pwfile_users;

-- Errors that point to this
-- ORA-01017 invalid username/password on the redo transport destination
SELECT dest_id, status, error FROM v$archive_dest WHERE dest_id = 2;`},
{h:'TDE wallets'},
{p:'If the primary uses **Transparent Data Encryption**, the standby needs the **same keys**. Copy the wallet (or use a shared location) before you build the standby. Section 9 explains it in detail.'},
{flow:['Copy the password file to the standby','Test a SYSDBA connection both ways','Copy the TDE wallet if encryption is used','Check V$ARCHIVE_DEST for authentication errors after transport starts']},
{note:'Keep the SYS password out of scripts and shell history. For production, use a protected response file or wallet for secrets.'}],
src:[['Password file and authentication',O.DG]]};

/* ---------- 6: Practical ---------- */
L['ora-dg:2:6']={blocks:[
{p:'Prepare a primary database for a physical standby. You will build the standby in the next section. Use two VMs with the same Oracle software, or one VM with two homes for a basic test.'},
{h:'Checklist'},
{flow:['Check and set ARCHIVELOG, FORCE LOGGING and Flashback','Set the Data Guard parameters on the primary','Create standby redo logs','Configure static listener entries and TNS aliases on both','Copy the password file to the standby host','Test connectivity']},
{h:'Commands (primary)'},
{code:`SELECT log_mode, force_logging, flashback_on FROM v$database;
ALTER DATABASE FORCE LOGGING;
ALTER DATABASE FLASHBACK ON;

ALTER SYSTEM SET log_archive_config = 'DG_CONFIG=(prod,stby)' SCOPE=BOTH;
ALTER SYSTEM SET log_archive_dest_2 =
  'SERVICE=stby ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=stby' SCOPE=BOTH;
ALTER SYSTEM SET log_archive_dest_state_2 = DEFER SCOPE=BOTH;     -- defer until the standby exists
ALTER SYSTEM SET fal_server = 'stby' SCOPE=BOTH;
ALTER SYSTEM SET standby_file_management = AUTO SCOPE=BOTH;

ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 11 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 12 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 13 SIZE 1G;
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 14 SIZE 1G;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`V$DATABASE`','ARCHIVELOG, FORCE_LOGGING YES, FLASHBACK_ON YES'],
['`V$STANDBY_LOG`','Four standby logs of the same size as ORLs'],
['`tnsping stby` from the primary host','OK'],
['`sqlplus sys@stby as sysdba` from the primary host','Connects to the idle (or started) standby instance'],
['Password file on standby host','Present and identical']]},
{h:'If something fails'},
{t:[['Symptom','Check'],
['`tnsping` fails','Listener, firewall, name in tnsnames.ora'],
['ORA-12514 on connect to stby','Static entry missing: instance is down'],
['ORA-01017','Password file not the same, or wrong password']]},
{note:'The destination is deferred on purpose. Enable it after the standby has been created in the next section.'}],
src:[['Data Guard Concepts and Administration',O.DG]]};

})();
