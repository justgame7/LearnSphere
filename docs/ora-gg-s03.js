/* LearnSphere - GoldenGate, Section 03: Installation & Deployment.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const hub=O.dg(700,230,[
[10,10,200,210,'Source database server',1],[25,45,170,50,'Oracle source database',0],[25,125,170,70,'Redo logs|(read over the network|or locally)',0],
[250,10,200,210,'GoldenGate hub server',1],[265,45,170,50,'Extract and Replicat',2],[265,125,170,70,'Trails, logs,|deployments',0],
[490,10,200,210,'Target database server',1],[505,45,170,50,'Oracle or other target',0],[505,125,170,70,'Replicat applies|over a database|connection',0]],
[[210,70,250,70],[450,70,490,70]]);

const steps=O.dg(700,120,[
[10,30,110,60,'1 Plan|sizing, platform',0],[140,30,110,60,'2 Install|OGG_HOME',2],[270,30,110,60,'3 Create|Service Manager',2],[400,30,110,60,'4 Create|deployments',2],[530,30,160,60,'5 Secure and test|proxy, TLS, patches',0]],
[[120,60,140,60],[250,60,270,60],[380,60,400,60],[510,60,530,60]]);

/* ---------- 0: Planning ---------- */
L['ora-gg:2:0']={blocks:[
{p:'A good plan decides where GoldenGate runs, how big it is, and what versions it uses. Most installation problems are planning problems.'},
{svg:hub},
{h:'Where to run it'},
{t:[['Option','Notes'],
['**On the source database server**','Simple, uses source CPU and disk'],
['**On a separate hub server**','Isolates the load, easier to scale and patch. Common choice for larger environments.'],
['**On the target server**','Convenient for pull-style replication']]},
{h:'Sizing'},
{t:[['Resource','Guide'],
['**CPU**','A few cores for a small flow. Parallel replication needs more.'],
['**Memory**','A few GB, more for large transactions and many processes'],
['**Trail disk**','Enough for the change volume during the longest outage you accept, plus lag. Measure the redo rate to estimate.'],
['**Network**','Enough for the peak change rate between source, hub and target'],
['**Database**','Extra redo and a few background sessions on source and target']]},
{h:'Compatibility'},
{ul:['Check the **certification matrix** for the database, GoldenGate and operating system versions.','Use a supported Linux. Use the same endianness and character set rules in mind.','Check that the database versions of source and target are supported by your GoldenGate version.']},
{flow:['Decide where GoldenGate will run','Size CPU, memory, disk and network from the redo rate','Check the certification matrix','Prepare the OS user, directories and ports']},
{note:'Trail space is the item most often undersized. When the target is down for a day, the trail must hold a day of changes.'}],
src:[['GoldenGate system requirements',O.GG]]};

/* ---------- 1: Install software ---------- */
L['ora-gg:2:1']={blocks:[
{p:'The GoldenGate software is installed with the **Oracle Universal Installer**. It places the software in **OGG_HOME**. No deployments exist yet.'},
{svg:steps},
{h:'Prepare'},
{code:`# As root: OS user and directories
groupadd oinstall
useradd -g oinstall ogg
mkdir -p /u01/ogg/ogg23 /u01/ogg/deployments
chown -R ogg:oinstall /u01/ogg`},
{h:'GUI install'},
{code:`# As ogg, from the unzipped installer
./runInstaller`},
{h:'Silent install with a response file'},
{code:`# oggcore.rsp (key values; see the template in the installer for all keys)
INSTALL_OPTION=ORA23c
SOFTWARE_LOCATION=/u01/ogg/ogg23
INVENTORY_LOCATION=/u01/app/oraInventory
UNIX_GROUP_NAME=oinstall

./runInstaller -silent -nowait -responseFile /home/ogg/oggcore.rsp`},
{t:[['Setting','Meaning'],
['`INSTALL_OPTION`','Which database family the installation is for (Oracle or another target)'],
['`SOFTWARE_LOCATION`','The OGG_HOME'],
['`INVENTORY_LOCATION`, `UNIX_GROUP_NAME`','Oracle inventory and group']]},
{h:'Check'},
{code:`export OGG_HOME=/u01/ogg/ogg23
$OGG_HOME/bin/adminclient -v`},
{note:'Use a response file in all but the first lab install. It makes installations repeatable and reviewable. Names of the INSTALL_OPTION values depend on the version, so use the template shipped with it.'}],
src:[['Installing GoldenGate',O.GG]]};

/* ---------- 2: oggca ---------- */
L['ora-gg:2:2']={blocks:[
{p:'After the software is installed, you create the **Service Manager** and the **deployments** with the configuration tool `oggca.sh`.'},
{h:'Interactive'},
{code:`export OGG_HOME=/u01/ogg/ogg23
$OGG_HOME/bin/oggca.sh`},
{p:'The wizard asks for the Service Manager location and port, the administrator user and password, and then each deployment.'},
{h:'Silent with a response file'},
{code:`# oggca.rsp (key values illustrative; use the template that ships with the software)
CONFIGURATION_OPTION=ADD
SERVICEMANAGER_DEPLOYMENT_HOME=/u01/ogg/sm
HOST_SERVICEMANAGER=ggsrc.example.com
PORT_SERVICEMANAGER=9011
SECURITY_ENABLED=true
ADMIN_USERNAME=oggadmin
ADMIN_PASSWORD=<password>
DEPLOYMENT_NAME=src_dep
DEPLOYMENT_HOME=/u01/ogg/deployments/src_dep
ADMINISTRATION_SERVER_ENABLED=true
DISTRIBUTION_SERVER_ENABLED=true
RECEIVER_SERVER_ENABLED=true
METRICS_SERVER_ENABLED=true

$OGG_HOME/bin/oggca.sh -silent -responseFile /home/ogg/oggca.rsp`},
{h:'What is created'},
{t:[['Item','Result'],
['Service Manager','Listens on its port, manages the deployments'],
['Deployment','Four services with their own ports, plus homes'],
['Administrator account','Used for the Web UI, Admin Client and REST'],
['Credential store','Ready to hold database credentials']]},
{flow:['Run oggca.sh','Create the Service Manager','Add a deployment for each role (source, target)','Note the ports and URLs','Log in to the Web UI']},
{note:'Keep the response file under version control, but keep the password out of it. Use a protected variable or a prompt.'}],
src:[['Configuring deployments',O.GG]]};

/* ---------- 3: Reverse proxy and security basics ---------- */
L['ora-gg:2:3']={blocks:[
{p:'Each service listens on its own port. A **reverse proxy** puts them behind **one secure address**, which is easier to open in a firewall and to protect.'},
{h:'Why a reverse proxy'},
{ul:['One port (443) for all services of a deployment.','TLS certificates managed in one place.','No need to open many ports across firewalls.','Common web security controls (headers, rate limits).']},
{h:'How'},
{t:[['Step','Detail'],
['Generate configuration','GoldenGate provides a script that writes an NGINX configuration for the deployments'],
['Install NGINX','On the same host or a separate server'],
['Install the certificate','A server certificate issued by your CA'],
['Reload NGINX','Use the generated configuration'],
['Use the single address','`https://gg.example.com/<deployment>/...`']]},
{h:'Security basics from day one'},
{t:[['Item','Rule'],
['**HTTPS everywhere**','Do not use plain HTTP'],
['**Administrator account**','Strong password, not shared. Create named users later (section 10).'],
['**Network access**','Allow only the hosts and users that need it'],
['**Database credentials**','Stored in the credential store, never in parameter files'],
['**OS user**','A dedicated user, not root']]},
{flow:['Install and create deployments','Generate the proxy configuration','Install certificates and start the proxy','Test the Web UI through the proxy address','Close the direct service ports to the outside']},
{note:'Section 10 covers TLS between deployments and users and roles in detail. Start with HTTPS from the beginning, to avoid reconfiguration later.'}],
src:[['Reverse proxy and security',O.GG]]};

/* ---------- 4: OPatch ---------- */
L['ora-gg:2:4']={blocks:[
{p:'GoldenGate is patched with **OPatch**, like the database. Plan a short outage for the deployments, and keep the change small and tested.'},
{h:'Steps'},
{flow:['Read the patch README and download the patch and a current OPatch','Stop the Extracts and Replicats in an orderly way (or let them reach a safe point)','Stop the Service Manager and the deployments','Apply the patch to OGG_HOME with OPatch','Start the Service Manager and the deployments, then start the processes']},
{code:`export ORACLE_HOME=/u01/ogg/ogg23
$ORACLE_HOME/OPatch/opatch lspatches
$ORACLE_HOME/OPatch/opatch apply /stage/ogg_patch/<patch id>
$ORACLE_HOME/OPatch/opatch lspatches`},
{t:[['Point','Notes'],
['**Backup**','Back up OGG_HOME and the deployment directories first'],
['**Order**','Patch the target side and the source side in the order the README gives'],
['**Test**','Apply it first in a test deployment with the same flow'],
['**Verify**','Check lag and error logs after the restart']]},
{h:'Rolling'},
{p:'With **two paths** or two deployments, you can patch one side at a time and keep the other running. A simple one-flow setup has a short pause in replication, and catches up from the trail.'},
{note:'Replication simply pauses while you patch. After the restart, Extract and Replicat continue from their checkpoints, and lag returns to normal.'}],
src:[['Patching GoldenGate',O.GG]]};

/* ---------- 5: Containers ---------- */
L['ora-gg:2:5']={blocks:[
{p:'Oracle publishes **container images** for GoldenGate. Containers give a fast, repeatable way to run a lab or a deployment.'},
{h:'Why containers'},
{ul:['A working GoldenGate in minutes.','Same image on every host: no install differences.','Easy to destroy and recreate in a lab.']},
{code:`# Illustrative: pull an image and run it with a volume for the deployment data
podman pull container-registry.oracle.com/goldengate/goldengate-oracle-free:latest      # example name: check the registry for the current image
podman run -d --name ogg -p 443:443 \\
  -e OGG_ADMIN=oggadmin -e OGG_ADMIN_PWD=<password> \\
  -v ogg-data:/u02/ogg \\
  container-registry.oracle.com/goldengate/goldengate-oracle-free:latest`},
{t:[['Point','Notes'],
['**Images**','Check the Oracle Container Registry for the current names and tags'],
['**Volumes**','Keep trail and deployment data on a volume, so it survives the container'],
['**Ports**','Publish the proxy or service ports you use'],
['**Secrets**','Pass passwords with secrets or protected variables']]},
{flow:['Pull the image','Run it with a data volume and an admin account','Open the Web UI on the published port','Create deployments and processes as usual']},
{note:'Names of images and environment variables change between releases. Use the current documentation of the image you pick.'}],
src:[['GoldenGate in containers','https://container-registry.oracle.com/'],['GoldenGate documentation',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:2:6']={blocks:[
{p:'Install GoldenGate and create a **source** and a **target** deployment. A single lab server can host both.'},
{h:'Steps'},
{flow:['Create the OS user and directories','Install the software into OGG_HOME','Run oggca to create the Service Manager and the source deployment','Add the target deployment with its own ports','Log in to both deployments in the Web UI']},
{code:`# 1. user and folders
useradd -g oinstall ogg; mkdir -p /u01/ogg/ogg23 /u01/ogg/deployments

# 2. install the software (silent)
./runInstaller -silent -nowait -responseFile /home/ogg/oggcore.rsp

# 3. create Service Manager and the source deployment
$OGG_HOME/bin/oggca.sh -silent -responseFile /home/ogg/oggca_src.rsp

# 4. add the target deployment
$OGG_HOME/bin/oggca.sh -silent -responseFile /home/ogg/oggca_tgt.rsp`},
{h:'Check your result'},
{t:[['Check','Expected'],
['`adminclient -v`','Prints the GoldenGate version'],
['Web UI, Service Manager','Lists `src_dep` and `tgt_dep`'],
['Each deployment','Administration, Distribution, Receiver and Metrics services running'],
['Credentials','You can log in with the administrator account'],
['Ports','Different for each deployment, no conflicts']]},
{h:'If it fails'},
{t:[['Symptom','Check'],
['Installer fails','OS packages, free disk space, the user and directories'],
['oggca fails','Ports already in use, wrong paths, missing permissions'],
['Cannot log in','Administrator account, HTTPS certificate warnings in the browser']]},
{note:'Take a snapshot of the lab after a clean install. You will use the same deployments for the labs in the next sections.'}],
src:[['Installing and configuring GoldenGate',O.GG]]};

})();
