/* LearnSphere - Grid Infrastructure, ASM & RAC, Section 07: Creating & Administering RAC Databases.
   Lectures 0-7 are core, 8-12 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const flow=O.dg(700,120,[
[10,30,110,60,'1 DB software|on all nodes|oracle user',0],[140,30,110,60,'2 DBCA|RAC database|2 instances',2],[270,30,110,60,'3 Check|srvctl status|v gv$instance',0],[400,30,110,60,'4 Services|application|connections',2],[530,30,160,60,'5 Maintain|rolling restarts,|patches',0]],
[[120,60,140,60],[250,60,270,60],[380,60,400,60],[510,60,530,60]]);

const roll=O.dg(700,180,[
[10,20,150,60,'Services drained|from node 1',0],[200,20,150,60,'Stop instance 1|do the work',2],[390,20,150,60,'Start instance 1|check services',2],[580,20,110,60,'Repeat on|node 2',0],
[10,110,680,55,'At every moment at least one instance serves users. Never stop both at once.',1]],
[[160,50,200,50],[350,50,390,50],[540,50,580,50]]);

/* ---------- 0: DBCA ---------- */
L['ora-rac:6:0']={blocks:[
{p:'A RAC database is created with **DBCA**, after the database software is installed on **all nodes**. DBCA creates the instances, the redo threads and undo tablespaces, and registers everything with Clusterware.'},
{svg:flow},
{h:'Step 1: Install the database software on all nodes'},
{code:`# As oracle on rac1, with the software unzipped into the DB home
./runInstaller -silent \\
  oracle.install.option=INSTALL_DB_SWONLY \\
  UNIX_GROUP_NAME=oinstall INVENTORY_LOCATION=/u01/app/oraInventory \\
  ORACLE_HOME=/u01/app/oracle/product/19.0.0/dbhome_1 ORACLE_BASE=/u01/app/oracle \\
  oracle.install.db.InstallEdition=EE \\
  oracle.install.db.OSDBA_GROUP=dba oracle.install.db.OSRACDBA_GROUP=racdba \\
  oracle.install.db.CLUSTER_NODES=rac1,rac2`},
{p:'Run `root.sh` of the database home on every node afterwards.'},
{h:'Step 2: Create the database'},
{code:`dbca -silent -createDatabase \\
  -templateName General_Purpose.dbc \\
  -gdbName orcl -sid orcl \\
  -databaseConfigType RAC -nodelist rac1,rac2 \\
  -createAsContainerDatabase true -numberOfPDBs 1 -pdbName pdb1 \\
  -storageType ASM -datafileDestination +DATA -recoveryAreaDestination +FRA \\
  -characterSet AL32UTF8 \\
  -sysPassword <password> -systemPassword <password> -pdbAdminPassword <password> \\
  -emConfiguration NONE`},
{t:[['Option','Meaning'],
['`-databaseConfigType RAC`','Create a RAC database (not single instance)'],
['`-nodelist`','Nodes where instances will run'],
['`-storageType ASM`','Use ASM disk groups'],
['`-datafileDestination +DATA`','Where datafiles go'],
['`-recoveryAreaDestination +FRA`','Fast Recovery Area']]},
{h:'What DBCA creates'},
{ul:['Instances `orcl1` on rac1 and `orcl2` on rac2.','Redo thread and undo tablespace for each instance.','A shared SPFILE and password file in ASM.','Cluster resources: database, instances and a default service.']},
{note:'If DBCA cannot see a node, check SSH equivalence for the oracle user and that the database software is installed on every node with the same path.'}],
src:[['Creating a RAC database',O.RAC],['DBCA',D+'admin/']]};

/* ---------- 1: srvctl ---------- */
L['ora-rac:6:1']={blocks:[
{p:'In a cluster, you start and stop databases with **srvctl**, not with `SHUTDOWN` in SQL*Plus. srvctl tells Clusterware what you want so that it does not restart something you stopped on purpose.'},
{h:'Status and configuration'},
{code:`srvctl status database -db orcl -verbose
srvctl config database -db orcl
srvctl status service -db orcl
srvctl status nodeapps
srvctl status listener`},
{h:'Start and stop'},
{t:[['Task','Command'],
['Start the whole database','`srvctl start database -db orcl`'],
['Stop the whole database','`srvctl stop database -db orcl -stopoption IMMEDIATE`'],
['Start one instance','`srvctl start instance -db orcl -instance orcl1`'],
['Stop one instance','`srvctl stop instance -db orcl -instance orcl1 -stopoption IMMEDIATE`'],
['Do not restart it automatically','`srvctl disable database -db orcl`'],
['Allow automatic restart again','`srvctl enable database -db orcl`']]},
{h:'Stop options'},
{t:[['Option','Meaning'],
['`NORMAL`','Wait for users to disconnect'],
['`TRANSACTIONAL`','Wait for transactions to end'],
['`IMMEDIATE`','Roll back active transactions (normal choice)'],
['`ABORT`','Kill the instance. Recovery needed.']]},
{flow:['You run srvctl stop instance','Clusterware sets the target to OFFLINE','The instance shuts down','Clusterware does not restart it','srvctl start instance sets the target to ONLINE again']},
{note:'If you stop an instance with SHUTDOWN in SQL*Plus, Clusterware sees an unexpected stop and may restart it. Use srvctl so the cluster agrees with your intention.'}],
src:[['srvctl command reference',O.RAC+'server-control-utility-reference.html']]};

/* ---------- 2: Parameters ---------- */
L['ora-rac:6:2']={blocks:[
{p:'Most parameters are the **same on every instance**. A few must differ by instance, and a few are set specially for RAC.'},
{h:'Must differ per instance'},
{t:[['Parameter','Why'],
['`INSTANCE_NUMBER`','Unique per instance'],
['`INSTANCE_NAME`','Unique name'],
['`THREAD`','Each instance has its own redo thread'],
['`UNDO_TABLESPACE`','Each instance has its own undo'],
['`LOCAL_LISTENER`','Points to the listener of that node VIP']]},
{h:'RAC-specific, usually the same everywhere'},
{t:[['Parameter','Meaning'],
['`CLUSTER_DATABASE`','TRUE'],
['`CLUSTER_DATABASE_INSTANCES`','Number of instances (usually set by Clusterware)'],
['`REMOTE_LISTENER`','`rac-scan:1521`: registers the instance with the SCAN listeners'],
['`DB_UNIQUE_NAME`, `DB_NAME`','Same for all instances']]},
{h:'Set a parameter'},
{code:`-- All instances
ALTER SYSTEM SET sga_target = 3G SCOPE = BOTH SID = '*';

-- One instance only
ALTER SYSTEM SET open_cursors = 800 SCOPE = BOTH SID = 'orcl1';

-- See the values per instance
SELECT inst_id, name, value FROM gv$parameter WHERE name IN ('sga_target','open_cursors','remote_listener');

-- Remove a per-instance override
ALTER SYSTEM RESET open_cursors SCOPE = SPFILE SID = 'orcl1';`},
{h:'Rules of thumb'},
{ul:['Keep SGA and key tuning parameters **identical** on all instances unless you have a reason.','Instances with different sizes make failover behave unpredictably.','Always state `SID` explicitly in ALTER SYSTEM on a cluster.']},
{note:'A static parameter needs a restart of every instance. Do it in a rolling way, one instance at a time, if the parameter allows different values during the change.'}],
src:[['RAC parameters',O.RAC]]};

/* ---------- 3: SPFILE, password file, redo ---------- */
L['ora-rac:6:3']={blocks:[
{p:'Everything that all instances must see lives in **ASM**: the SPFILE, the password file, the control files and the redo logs of every thread.'},
{h:'SPFILE and password file'},
{code:`srvctl config database -db orcl
-- Spfile: +DATA/ORCL/PARAMETERFILE/spfile.267.1157234567
-- Password file: +DATA/ORCL/PASSWORD/pwdorcl.256.1157234111

SHOW PARAMETER spfile`},
{p:'On each node, a small file `$ORACLE_HOME/dbs/initorcl1.ora` contains one line: `SPFILE=\'+DATA/ORCL/PARAMETERFILE/spfile.267...\'`. Instances read the shared SPFILE through it.'},
{h:'Move or copy the password file'},
{code:`srvctl modify database -db orcl -pwfile +DATA/orcl/orapworcl
asmcmd pwcopy /u01/app/oracle/product/19.0.0/dbhome_1/dbs/orapworcl +DATA/orcl/orapworcl`},
{h:'Redo in a RAC database'},
{code:`SELECT thread#, group#, bytes/1024/1024 AS mb, members, status FROM gv$log ORDER BY thread#, group#;

-- Add redo for thread 2 (with OMF the file names are automatic)
ALTER DATABASE ADD LOGFILE THREAD 2 GROUP 5 SIZE 1G;
ALTER DATABASE ADD LOGFILE THREAD 2 GROUP 6 SIZE 1G;`},
{h:'Archive logs'},
{t:[['Rule','Reason'],
['Archive destination must be **shared** (for example +FRA)','Any instance may need to read the archive logs of any thread during recovery'],
['Same ARCHIVELOG mode for the whole database','Archive mode is a database setting'],
['Each thread archives its own logs','Thread number is part of the archive name']]},
{flow:['Each instance writes redo to its own thread in ASM','Archive logs go to the shared +FRA','Any instance can read any thread for recovery','Backups can run from any node']},
{note:'Do not put archive logs on a local disk of one node. If that node fails, the others cannot read them, and recovery or standby shipping stops.'}],
src:[['RAC storage',O.RAC],['Managing redo in RAC',O.RAC]]};

/* ---------- 4: Add and remove instances ---------- */
L['ora-rac:6:4']={blocks:[
{p:'RAC grows and shrinks by adding or removing nodes and instances. The tools do most of the work, but you must do the steps in the right order.'},
{h:'Add a node and an instance'},
{flow:['Prepare the new node: OS, users, networks, SSH, cluvfy','Add the node to the cluster with addnode.sh from the Grid home','Add the database software to the node with addnode.sh from the DB home','Add the instance with DBCA or srvctl','Add its services and check']},
{code:`# 1. Grid home (as grid, on an existing node)
cd $GRID_HOME/addnode
./addnode.sh -silent "CLUSTER_NEW_NODES={rac3}" "CLUSTER_NEW_VIRTUAL_HOSTNAMES={rac3-vip}"

# 2. DB home (as oracle)
cd $ORACLE_HOME/addnode
./addnode.sh -silent "CLUSTER_NEW_NODES={rac3}"

# 3. Instance
dbca -silent -addInstance -gdbName orcl -nodeName rac3 -instanceName orcl3 \\
  -sysDBAUserName sys -sysDBAPassword <password>`},
{h:'Remove an instance and a node'},
{code:`# Remove the instance
dbca -silent -deleteInstance -gdbName orcl -instanceName orcl3 \\
  -sysDBAUserName sys -sysDBAPassword <password>

# Remove the node from the cluster (as root, from another node)
crsctl delete node -n rac3`},
{t:[['Step','What it removes'],
['`dbca -deleteInstance`','Instance, thread and undo'],
['Deinstall the DB home on the node','Database software'],
['`crsctl delete node`','Node from the cluster'],
['Deinstall the Grid home on the node','Clusterware software on that node']]},
{h:'Checks after a change'},
{code:`olsnodes -n -s
srvctl status database -db orcl
SELECT inst_id, instance_name, host_name FROM gv$instance;
cluvfy stage -post nodeadd -n rac3`},
{note:'Do not remove a node by deleting directories. Use the supported tools, so that the OCR, inventory and resources stay consistent.'}],
src:[['Adding and removing nodes',O.RAC]]};

/* ---------- 5: Multitenant ---------- */
L['ora-rac:6:5']={blocks:[
{p:'On RAC, a **PDB can be open on some or all instances**. Applications reach a PDB through a **service defined for that PDB**.'},
{h:'Open PDBs on instances'},
{code:`ALTER PLUGGABLE DATABASE pdb1 OPEN INSTANCES = ALL;
ALTER PLUGGABLE DATABASE pdb1 SAVE STATE INSTANCES = ALL;

SELECT inst_id, name, open_mode FROM gv$pdbs ORDER BY name, inst_id;`},
{t:[['Clause','Meaning'],
['`INSTANCES = ALL`','On every instance'],
['`INSTANCES = (orcl1)`','On a named instance only'],
['`INSTANCES = ALL EXCEPT (orcl2)`','All except one']]},
{h:'A service per PDB'},
{code:`srvctl add service -db orcl -pdb pdb1 -service pdb1_svc -preferred orcl1,orcl2
srvctl start service -db orcl -service pdb1_svc
srvctl status service -db orcl -service pdb1_svc

-- Client
sqlplus app_user@//rac-scan:1521/pdb1_svc`},
{h:'Why not the default PDB service?'},
{ul:['The default PDB service (named after the PDB) always exists and runs where the PDB is open.','A **custom service** lets you control which instances serve it, for failover, load and maintenance.','Application Continuity and draining are configured per service.']},
{flow:['Open the PDB on the instances you need','Save the state for all instances','Create a service for the PDB with preferred and available instances','Applications use that service through the SCAN']},
{note:'If a PDB is closed on an instance, its service cannot run there. Check open mode with GV$PDBS when a service does not start.'}],
src:[['RAC and multitenant',O.RAC],['Multitenant Administrator Guide',O.MT]]};

/* ---------- 6: Rolling restarts ---------- */
L['ora-rac:6:6']={blocks:[
{p:'One of the biggest RAC benefits is **rolling maintenance**: restart or patch nodes one at a time while the service stays up. The key is to **drain** sessions from a node before you stop it.'},
{svg:roll},
{h:'Rolling restart of one instance'},
{code:`# Stop gracefully: move services away, give sessions time to finish
srvctl stop instance -db orcl -instance orcl1 -drain_timeout 120 -stopoption IMMEDIATE

# ... do the maintenance on node 1 ...

srvctl start instance -db orcl -instance orcl1
srvctl status service -db orcl`},
{t:[['Option','Meaning'],
['`-drain_timeout`','Seconds that sessions have to finish and move before the stop'],
['`-stopoption IMMEDIATE`','How to stop what remains']]},
{h:'Runbook for each node'},
{flow:['Check that the other node is healthy and carries its services','Stop the instance (or services) with a drain timeout','Do the maintenance: parameter change, OS patch, patch with opatchauto','Start the instance and wait until services are online','Check workload, then move to the next node']},
{h:'Checks between nodes'},
{code:`srvctl status database -db orcl -verbose
srvctl status service -db orcl
SELECT inst_id, status FROM gv$instance;
SELECT inst_id, COUNT(*) FROM gv$session WHERE username IS NOT NULL GROUP BY inst_id;`},
{note:'Never take down the second node before the first has fully rejoined and its services are running. Always keep at least one healthy instance.'}],
src:[['Rolling maintenance',O.RAC]]};

/* ---------- 7: Practical ---------- */
L['ora-rac:6:7']={blocks:[
{p:'Create a two-node RAC database and then practise the daily administration tasks.'},
{h:'Part 1: Create'},
{flow:['Install the database software on both nodes with the CLUSTER_NODES list','Run root.sh for the DB home on both nodes','Run dbca -silent with -databaseConfigType RAC','Wait for completion and read the DBCA log']},
{h:'Part 2: Verify'},
{code:`srvctl status database -db orcl -verbose
srvctl config database -db orcl
SELECT inst_id, instance_name, host_name, status FROM gv$instance;
SELECT thread#, group#, members FROM gv$log ORDER BY 1,2;
SELECT inst_id, value FROM gv$parameter WHERE name = 'undo_tablespace';
SELECT name, open_mode FROM v$pdbs;`},
{h:'Part 3: Administer'},
{code:`srvctl stop instance -db orcl -instance orcl2 -stopoption IMMEDIATE
srvctl status database -db orcl
srvctl start instance -db orcl -instance orcl2

ALTER SYSTEM SET open_cursors = 600 SCOPE = BOTH SID = '*';
ALTER PLUGGABLE DATABASE pdb1 OPEN INSTANCES = ALL;
ALTER PLUGGABLE DATABASE pdb1 SAVE STATE INSTANCES = ALL;

srvctl add service -db orcl -pdb pdb1 -service pdb1_svc -preferred orcl1,orcl2
srvctl start service -db orcl -service pdb1_svc`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`gv$instance`','Two rows, both OPEN'],
['`gv$log`','Two threads, at least two groups each'],
['Undo tablespace','Different per instance'],
['After stopping orcl2','The database stays up on orcl1'],
['`pdb1_svc`','Online on both instances']]},
{h:'Challenge'},
{ul:['Connect through `rac-scan` with the service and run `SELECT instance_name FROM v$instance` ten times to see the distribution.','Stop instance 1 while a session is connected through it and observe what the client sees.']},
{note:'Take a snapshot after a clean build. It is the base for the services and failover labs in the next section.'}],
src:[['RAC Administration and Deployment Guide',O.RAC]]};

})();
