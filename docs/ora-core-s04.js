/* LearnSphere - Oracle Core DBA, Section 04: Installation & Database Creation.
   Lectures 0-8 are core, 9-13 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const steps=O.dg(700,120,[
[10,30,115,60,'1 Prepare|OS, users,|kernel',0],[150,30,115,60,'2 Install|software|(Oracle Home)',2],[290,30,115,60,'3 Listener|netca',0],[430,30,115,60,'4 Create DB|dbca',2],[570,30,120,60,'5 After|patch, startup,|backup',0]],
[[125,60,150,60],[265,60,290,60],[405,60,430,60],[545,60,570,60]]);

const ofa=O.dg(700,260,[
[10,10,330,240,'/u01/app  (software)',1],
[30,45,290,34,'oraInventory   list of installed homes',0],
[30,90,290,34,'oracle   =  ORACLE_BASE',2],
[50,135,270,34,'product/19.0.0/dbhome_1  =  ORACLE_HOME',2],
[50,180,250,34,'diag   admin   (logs, traces, scripts)',0],
[360,10,330,115,'/u02  (data)',1],[380,45,290,60,'oradata/FREE   datafiles, redo logs, control files',0],
[360,135,330,115,'/u03  (recovery)',1],[380,170,290,60,'fast_recovery_area   backups, archived logs',0]],[]);

/* ---------- 0: Planning ---------- */
L['ora-core:3:0']={blocks:[
{p:'A good installation starts before the installer. Most failed installs come from the server not being ready. This lecture lists what to check first.'},
{svg:steps},
{h:'What to plan'},
{t:[['Item','Typical requirement (19c on Linux)'],
['**Operating system**','Oracle Linux or Red Hat Enterprise Linux. Check the certification matrix for the exact minor version.'],
['**Memory**','At least 8 GB RAM for a real database. A lab can use less.'],
['**Swap**','Follow the installation guide: about the size of RAM for small servers, 16 GB for large ones.'],
['**Disk for software**','About 10 GB for one Oracle Home'],
['**Disk for data**','Separate from software. Size for growth and backups.'],
['**Network**','Fixed hostname and IP address, name resolution that works']]},
{note:'Always confirm requirements in the Installation Guide for **your** release and platform. They change with every release.'},
{h:'The preinstall package: do not tune by hand'},
{p:'On Oracle Linux, one package prepares the whole OS. It creates the `oracle` user, the groups and sets the kernel parameters and limits.'},
{code:`# Oracle Linux 8, for 19c
sudo dnf install -y oracle-database-preinstall-19c

# Check the result
id oracle
sysctl fs.file-max kernel.sem`},
{h:'What it sets'},
{t:[['Area','Examples'],
['**Users and groups**','`oracle` user, `oinstall`, `dba`, `oper`, `backupdba`, `dgdba`, `kmdba`, `racdba`'],
['**Kernel parameters**','`fs.file-max`, `kernel.sem`, `kernel.shmmax`, `kernel.shmall`, `fs.aio-max-nr`, network buffers'],
['**Shell limits**','Open files (`nofile`), processes (`nproc`), stack, locked memory (`memlock`)']]},
{h:'Other checks'},
{ul:['Turn off **Transparent Huge Pages** and use regular HugePages for large SGAs.','Set the time zone and keep the clock synchronised (chrony).','Check firewall rules for the listener port (1521).','Know which character set the database will use (AL32UTF8 is the standard).']},
{flow:['Check certified OS and hardware','Install the preinstall package','Create mount points for software, data and recovery','Download and verify the Oracle software','Run the installer']}],
src:[['Database Installation Guide for Linux',D+'ladbi/'],['Oracle Linux preinstall RPM','https://docs.oracle.com/en/database/oracle/oracle-database/19/ladbi/running-rpm-packages-to-simplify-oracle-database-installation.html']]};

/* ---------- 1: OFA ---------- */
L['ora-core:3:1']={blocks:[
{p:'The **Optimal Flexible Architecture (OFA)** is Oracle standard way of laying out folders. It keeps software, data and logs apart, so patching, growth and recovery stay simple.'},
{svg:ofa},
{h:'The four directory names'},
{t:[['Name','Meaning','Typical path'],
['**Oracle Inventory**','List of all Oracle software installed on the server','`/u01/app/oraInventory`'],
['**ORACLE_BASE**','Top folder for Oracle software and diagnostics of one OS user','`/u01/app/oracle`'],
['**ORACLE_HOME**','One installed version of the software. The binaries.','`/u01/app/oracle/product/19.0.0/dbhome_1`'],
['**Data location**','Datafiles, redo logs and control files','`/u02/oradata/<DBNAME>`']]},
{h:'Why separate them'},
{t:[['Separation','Benefit'],
['Software vs data','You can replace or patch the home without touching data.'],
['Data vs recovery area','Losing the data disk does not lose the backups.'],
['One home per version','Old and new releases live side by side during an upgrade.']]},
{h:'Directories created inside ORACLE_BASE'},
{ul:['`diag` holds the Automatic Diagnostic Repository: alert log and traces.','`admin` holds scripts and wallets for each database.','`cfgtoollogs` holds logs from DBCA and the installer.']},
{code:`mkdir -p /u01/app/oracle/product/19.0.0/dbhome_1
mkdir -p /u02/oradata /u03/fast_recovery_area
chown -R oracle:oinstall /u01 /u02 /u03
chmod -R 775 /u01`},
{note:'Do not install the Oracle Home inside a user home folder, and never use `/tmp`. Keep the same layout on every server so scripts and runbooks work everywhere.'}],
src:[['Oracle Base and Oracle Home',D+'ladbi/about-oracle-base-and-oracle-home.html'],['Optimal Flexible Architecture',D+'ladbi/']]};

/* ---------- 2: Install software ---------- */
L['ora-core:3:2']={blocks:[
{p:'Installing the **software** only places the programs in the Oracle Home. It does not create a database. You can do it with a graphical wizard or silently with a **response file**, which is the way to automate it.'},
{h:'Image-based installation (19c and later)'},
{flow:['Download the database zip file','Unzip it directly into the new Oracle Home','Run runInstaller from that home','Run the root scripts as root when asked','Check the inventory and the home']},
{code:`# As the oracle user
cd /u01/app/oracle/product/19.0.0/dbhome_1
unzip -q /stage/LINUX.X64_193000_db_home.zip

# Graphical
./runInstaller`},
{h:'Silent installation with a response file'},
{p:'The installer includes a template. Copy it, edit the values and run the installer without a GUI.'},
{code:`cp $ORACLE_HOME/install/response/db_install.rsp /home/oracle/my_install.rsp

# Key values in my_install.rsp
oracle.install.option=INSTALL_DB_SWONLY
UNIX_GROUP_NAME=oinstall
INVENTORY_LOCATION=/u01/app/oraInventory
ORACLE_BASE=/u01/app/oracle
oracle.install.db.InstallEdition=EE
oracle.install.db.OSDBA_GROUP=dba
oracle.install.db.OSBACKUPDBA_GROUP=backupdba
oracle.install.db.OSDGDBA_GROUP=dgdba
oracle.install.db.OSKMDBA_GROUP=kmdba
oracle.install.db.OSRACDBA_GROUP=racdba

# Run it
$ORACLE_HOME/runInstaller -silent -responseFile /home/oracle/my_install.rsp`},
{h:'Scripts to run as root'},
{t:[['Script','Purpose'],
['`orainstRoot.sh`','Creates or fixes the Oracle Inventory pointer (first install on the server)'],
['`root.sh`','Sets permissions on a few files in the Oracle Home']]},
{code:`# As root, when the installer asks
/u01/app/oraInventory/orainstRoot.sh
/u01/app/oracle/product/19.0.0/dbhome_1/root.sh`},
{h:'Check it worked'},
{code:`$ORACLE_HOME/OPatch/opatch lspatches
$ORACLE_HOME/bin/sqlplus -V`},
{note:'The software-only option installs the home and nothing else. You then create the database with DBCA, which gives you control over every setting.'}],
src:[['Installing Oracle Database',D+'ladbi/installing-oracle-database.html'],['Response files',D+'ladbi/']]};

/* ---------- 3: DBCA ---------- */
L['ora-core:3:3']={blocks:[
{p:'The **Database Configuration Assistant (DBCA)** creates the database: datafiles, redo logs, control files, parameters, and the CDB with its PDBs. It has a GUI and a silent mode.'},
{h:'What DBCA asks'},
{t:[['Setting','Recommended choice'],
['**Creation mode**','Typical for a quick start, Advanced for control'],
['**Global database name and SID**','Short name, for example ORCL'],
['**Container database**','Yes (CDB), with at least one PDB'],
['**Storage**','File system, or ASM for Oracle Restart and RAC'],
['**Character set**','`AL32UTF8` (Unicode). It is very hard to change later.'],
['**Memory**','A percentage of RAM, or set SGA and PGA yourself'],
['**Passwords**','Strong, different for SYS, SYSTEM and the PDB admin']]},
{h:'Silent creation'},
{code:`dbca -silent -createDatabase \\
  -templateName General_Purpose.dbc \\
  -gdbName ORCL -sid ORCL \\
  -createAsContainerDatabase true \\
  -numberOfPDBs 1 -pdbName PDB1 \\
  -sysPassword <password> -systemPassword <password> -pdbAdminPassword <password> \\
  -datafileDestination /u02/oradata \\
  -characterSet AL32UTF8 -nationalCharacterSet AL16UTF16 \\
  -memoryPercentage 40 \\
  -emConfiguration NONE`},
{flow:['DBCA copies and prepares the files from a template','It creates the instance and the CDB','It creates the PDB from the seed','It configures the listener registration','It prints the log folder path']},
{h:'What exists afterwards'},
{t:[['Object','Check with'],
['Running instance','`ps -ef | grep pmon`'],
['CDB and PDB','`SELECT name, open_mode FROM v$pdbs;`'],
['Datafiles','`SELECT name FROM v$datafile;`'],
['Logs of the creation','`$ORACLE_BASE/cfgtoollogs/dbca/<SID>`']]},
{note:'Do not pass real passwords on the command line on a shared server. Use a response file with restricted permissions, or prompt for them, because command lines are visible to other users.'}],
src:[['Creating a database with DBCA',D+'admin/creating-and-configuring-an-oracle-database.html'],['DBCA command-line reference',D+'admin/']]};

/* ---------- 4: Post-install ---------- */
L['ora-core:3:4']={blocks:[
{p:'After DBCA finishes, a few small steps make the server ready for daily work. Skipping them causes the odd problems that waste a DBA time.'},
{h:'The checklist'},
{t:[['Step','Command or file'],
['**Set environment variables**','`ORACLE_BASE`, `ORACLE_HOME`, `ORACLE_SID`, `PATH` in the oracle user profile'],
['**Check oratab**','`/etc/oratab` has one line per database'],
['**Start the listener**','`lsnrctl start` and `lsnrctl status`'],
['**Apply the latest Release Update**','Use OPatch and Datapatch (see the Upgrade sub-course)'],
['**Save PDB state**','`ALTER PLUGGABLE DATABASE ALL SAVE STATE;`'],
['**Check the alert log**','No errors since creation'],
['**Take a first backup**','Before you add any data']]},
{h:'The profile'},
{code:`# ~/.bash_profile of the oracle user
export ORACLE_BASE=/u01/app/oracle
export ORACLE_HOME=$ORACLE_BASE/product/19.0.0/dbhome_1
export ORACLE_SID=ORCL
export PATH=$ORACLE_HOME/bin:$PATH
export LD_LIBRARY_PATH=$ORACLE_HOME/lib`},
{h:'The oratab file'},
{p:'`/etc/oratab` lists databases on the server. Each line is **SID : ORACLE_HOME : startup flag**.'},
{code:`ORCL:/u01/app/oracle/product/19.0.0/dbhome_1:Y

# Y = start with dbstart at boot, N = do not
# Use the oraenv script to switch the environment
. oraenv
ORACLE_SID = [ORCL] ? ORCL`},
{flow:['Log in as oracle','Run oraenv to pick the database','sqlplus / as sysdba','Verify instance, PDBs and listener']},
{h:'Verify'},
{code:`lsnrctl status
sqlplus / as sysdba
SELECT instance_name, status FROM v$instance;
SELECT name, open_mode FROM v$pdbs;`},
{note:'If a PDB is not open after a reboot, you forgot to save its state. Section 9 explains it in detail.'}],
src:[['Post-installation tasks',D+'ladbi/oracle-database-postinstallation-tasks.html']]};

/* ---------- 5: Auto start ---------- */
L['ora-core:3:5']={blocks:[
{p:'After a server reboot the database and listener must come up on their own. On Linux there are two common methods: **systemd with dbstart** and **Oracle Restart**.'},
{h:'The two methods'},
{t:[['Method','How','Best for'],
['**systemd + dbstart/dbshut**','A service file calls Oracle scripts. Needs the oratab flag set to Y.','Simple single servers'],
['**Oracle Restart**','Part of Grid Infrastructure. Monitors and restarts the database and listener.','Servers using ASM, or where automatic restart after failure matters']]},
{h:'systemd service for the database'},
{code:`# /etc/systemd/system/oracle-db.service
[Unit]
Description=Oracle Database and Listener
After=network.target

[Service]
Type=forking
User=oracle
Group=oinstall
Environment=ORACLE_HOME=/u01/app/oracle/product/19.0.0/dbhome_1
ExecStart=/u01/app/oracle/product/19.0.0/dbhome_1/bin/dbstart /u01/app/oracle/product/19.0.0/dbhome_1
ExecStop=/u01/app/oracle/product/19.0.0/dbhome_1/bin/dbshut /u01/app/oracle/product/19.0.0/dbhome_1
RemainAfterExit=yes
TimeoutSec=600

[Install]
WantedBy=multi-user.target`},
{code:`sudo systemctl daemon-reload
sudo systemctl enable --now oracle-db
systemctl status oracle-db`},
{flow:['Server boots and systemd starts the service','dbstart reads /etc/oratab','Databases marked Y are started','The listener is started','PDBs open if their state was saved']},
{h:'Do not forget PDB state'},
{code:`-- In the root
ALTER PLUGGABLE DATABASE ALL SAVE STATE;`},
{note:'Test it. Reboot the lab server once and confirm the database comes up without anyone logging in.'}],
src:[['Starting and stopping with dbstart',D+'ladbi/'],['Oracle Restart',D+'ladbi/']]};

/* ---------- 6: Read-only home and gold images ---------- */
L['ora-core:3:6']={blocks:[
{p:'Two modern ideas make patching and deployment safer: a **read-only Oracle Home** and **gold images**.'},
{h:'Read-only Oracle Home'},
{p:'In a read-only home the software folder never changes after installation. Files that change (logs, configuration, runtime files) move to **ORACLE_BASE**.'},
{t:[['','Traditional home','Read-only home'],
['**Config files**','Inside the home','In ORACLE_BASE_CONFIG'],
['**Logs and temporary files**','Inside the home','In ORACLE_BASE_HOME'],
['**Home content over time**','Changes constantly','Fixed, only changed by patching'],
['**Cloning and copying**','Home may contain local state','Home can be copied cleanly']]},
{code:`# Enable it (before the home is used by a database)
$ORACLE_HOME/bin/roohctl -enable

# See where the config now lives
$ORACLE_HOME/bin/orabasehome`},
{h:'Gold images'},
{p:'A **gold image** is a patched and tested Oracle Home saved as a zip file. You deploy the same image to every server instead of patching each one.'},
{flow:['Install a home and apply the quarterly patch','Test it with your applications','Create the gold image zip','Unzip it into a new home on every server','Move the databases to the new home']},
{code:`# Create a gold image from a patched home
$ORACLE_HOME/runInstaller -silent -createGoldImage -destinationLocation /stage/goldimages`},
{t:[['Benefit','Why it helps'],
['**Consistency**','Every server runs the identical software.'],
['**Speed**','Unzip instead of repeated patching.'],
['**Rollback**','The old home stays in place until the move is proven.']]},
{note:'This is called out-of-place patching. It is the recommended way to patch and is covered in the Upgrade, Patching and Migration sub-course.'}],
src:[['Read-only Oracle Home',D+'ladbi/'],['Gold images',D+'ladbi/']]};

/* ---------- 7: Removing ---------- */
L['ora-core:3:7']={blocks:[
{p:'Removing a database or an Oracle Home cleanly matters as much as installing one. Half-removed software leaves files, inventory entries and startup scripts behind.'},
{h:'The right order'},
{flow:['Take a final backup if the data may ever be needed','Delete the database with DBCA','Stop the listener and any services','Remove the Oracle Home with the deinstall tool','Remove oratab lines, profile entries and systemd units','Delete the data and recovery directories after you check them']},
{h:'Delete a database'},
{code:`dbca -silent -deleteDatabase \\
  -sourceDB ORCL \\
  -sysDBAUserName sys -sysDBAPassword <password>`},
{h:'Remove an Oracle Home'},
{code:`# Stop everything that uses the home first
lsnrctl stop

# Run the supplied deinstall tool
$ORACLE_HOME/deinstall/deinstall`},
{h:'Clean-up checklist'},
{t:[['Check','Where'],
['Inventory entry removed','`/u01/app/oraInventory/ContentsXML/inventory.xml`'],
['No leftover lines for the database','`/etc/oratab`'],
['No startup unit','`/etc/systemd/system`'],
['Environment variables','`~/.bash_profile`'],
['Data folders deleted or archived','`/u02/oradata`, `/u03/fast_recovery_area`']]},
{note:'Never remove an Oracle Home by deleting the folder. The inventory would still list it, and later installs or patches can fail in confusing ways.'}],
src:[['Removing Oracle Database software',D+'ladbi/removing-oracle-database-software.html'],['Deleting a database with DBCA',D+'admin/']]};

/* ---------- 8: Practical ---------- */
L['ora-core:3:8']={blocks:[
{p:'Put the whole section together on a Linux server: install the software, create a CDB with one PDB and check it. This lab needs an **Oracle Linux virtual machine** with Enterprise Edition media (the free Free container cannot practise installation).'},
{h:'Goal'},
{ul:['Prepare the server with the preinstall package.','Install 19c software silently.','Create a CDB with one PDB using DBCA.','Prove it works after a reboot.']},
{h:'Steps'},
{flow:['Take a VM snapshot before you start','Install the preinstall package','Create the OFA folders and set the profile','Unzip the software and run the silent install','Run orainstRoot.sh and root.sh','Create the listener and the CDB with DBCA','Enable auto start and reboot the VM']},
{code:`# 1. Prepare
sudo dnf install -y oracle-database-preinstall-19c
sudo mkdir -p /u01/app/oracle/product/19.0.0/dbhome_1 /u02/oradata /u03/fast_recovery_area
sudo chown -R oracle:oinstall /u01 /u02 /u03

# 2. Install (as oracle)
cd /u01/app/oracle/product/19.0.0/dbhome_1
unzip -q /stage/LINUX.X64_193000_db_home.zip
./runInstaller -silent -responseFile /home/oracle/my_install.rsp

# 3. Create the database
dbca -silent -createDatabase -templateName General_Purpose.dbc -gdbName ORCL -sid ORCL \\
  -createAsContainerDatabase true -numberOfPDBs 1 -pdbName PDB1 \\
  -sysPassword <pw> -systemPassword <pw> -pdbAdminPassword <pw> \\
  -datafileDestination /u02/oradata -characterSet AL32UTF8 -emConfiguration NONE`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`SELECT name, cdb FROM v$database;`','ORCL and YES'],
['`SELECT name, open_mode FROM v$pdbs;`','PDB$SEED READ ONLY, PDB1 READ WRITE'],
['`lsnrctl status`','Service ORCL and PDB1 listed'],
['`opatch lspatches`','Lists the installed patches'],
['After reboot','Database and listener running, PDB1 open']]},
{h:'If something goes wrong'},
{t:[['Symptom','Look at'],
['Installer fails a check','The prerequisite log in `/tmp/InstallActions...` and the OS package list'],
['DBCA stops','`$ORACLE_BASE/cfgtoollogs/dbca/ORCL`'],
['Listener not found','Run `lsnrctl status` and check `ORACLE_HOME` in your profile'],
['PDB closed after reboot','Run `ALTER PLUGGABLE DATABASE ALL SAVE STATE;`']]},
{note:'Revert the snapshot and do it again from memory. The second time you will understand every step.'}],
src:[['Database Installation Guide for Linux',D+'ladbi/'],['Administrator Guide: Creating a database',D+'admin/creating-and-configuring-an-oracle-database.html']]};

})();
