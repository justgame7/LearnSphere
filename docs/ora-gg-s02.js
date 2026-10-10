/* LearnSphere - GoldenGate, Section 02: Microservices Architecture.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const svcs=O.dg(700,250,[
[10,10,680,60,'Service Manager: starts and monitors the deployments on this host',2],
[10,90,680,150,'Deployment (one set of services, one environment, for example Source)',1],
[30,125,125,45,'Administration|Server',0],[170,125,125,45,'Distribution|Server',0],[310,125,125,45,'Receiver|Server',0],[450,125,125,45,'Performance|Metrics Server',0],
[30,185,545,45,'Processes live here: Extract, Replicat, trail files, checkpoints',0]],
[[350,70,350,90]]);

const flow=O.dg(700,230,[
[10,10,320,210,'Source deployment',1],[30,45,140,50,'Extract|reads the database log',2],[190,45,120,50,'Local trail|aa',0],[30,115,280,40,'Distribution Server: path',0],
[370,10,320,210,'Target deployment',1],[390,45,140,50,'Receiver Server|writes remote trail|ba',2],[550,45,120,50,'Replicat|applies to target',2],
[390,115,280,40,'Target database',0],[30,165,640,40,'Administration Servers manage the processes on each side',0]],
[[170,70,190,70],[310,135,390,70],[530,70,550,70],[610,95,610,115]]);

/* ---------- 0: Services ---------- */
L['ora-gg:1:0']={blocks:[
{p:'Microservices Architecture splits GoldenGate into several **services**. Each one does a part of the work, and each has a web address and a REST API.'},
{svg:svcs},
{h:'The services'},
{t:[['Service','Job'],
['**Service Manager**','Starts, stops and monitors the deployments on a host. One per host (or per installation).'],
['**Administration Server**','Create and manage Extract and Replicat, parameters, credentials, and the database connection'],
['**Distribution Server**','Sends trail files from this deployment to other deployments (distribution paths)'],
['**Receiver Server**','Receives trail data from other deployments'],
['**Performance Metrics Server**','Collects and shows metrics about processes and lag']]},
{h:'Where you work'},
{t:[['Interface','Use'],
['**Web UI**','Browser interface to every service'],
['**Admin Client**','Command-line client (`adminclient`) that replaces GGSCI'],
['**REST API**','Programs and scripts use it']]},
{p:'Each service listens on a **port** chosen at installation. The Service Manager port is the entry point: from it you reach the services of every deployment.'},
{flow:['The Service Manager starts the deployment','The deployment has its Administration, Distribution, Receiver and Metrics services','You manage processes through the Administration Server','Trails move between deployments by the Distribution and Receiver Servers']},
{note:'In earlier (Classic) versions one manager process did all this, with GGSCI. In Microservices Architecture the same jobs are split into services you can reach from a browser.'}],
src:[['Microservices Architecture',O.GG]]};

/* ---------- 1: Deployments and homes ---------- */
L['ora-gg:1:1']={blocks:[
{p:'A **deployment** is one set of services and data with its own directories and settings. A host can have several deployments, for example one for each source and target.'},
{h:'Homes'},
{t:[['Home','Contains'],
['`OGG_HOME`','The GoldenGate **software** (binaries). Shared by all deployments of that version.'],
['`OGG_ETC_HOME`','Deployment configuration files and parameter files'],
['`OGG_CONF_HOME`','Process configuration (parameter files for Extract and Replicat)'],
['`OGG_VAR_HOME`','Variable data: logs, reports, trails'],
['`OGG_DATA_HOME`','Trail files and checkpoint data'],
['`OGG_SSL_HOME`','Certificates and wallets for this deployment']]},
{h:'Typical layout'},
{code:`/u01/ogg/ogg23              OGG_HOME (software)
/u01/ogg/sm                 Service Manager deployment
/u01/ogg/deployments/src    Source deployment (etc, var, conf)
/u01/ogg/deployments/tgt    Target deployment`},
{h:'Why several deployments'},
{ul:['Separate environments (production and test) on one host.','Separate the Extract side from the Replicat side.','Patch or upgrade one deployment at a time.']},
{flow:['Install the software once (OGG_HOME)','Create the Service Manager','Create one deployment for each role or environment','Each deployment has its own homes and ports']},
{note:'Keep deployment homes on fast, protected storage with plenty of space. Trails and logs grow with the amount of change in the source.'}],
src:[['Deployments',O.GG]]};

/* ---------- 2: Data flow ---------- */
L['ora-gg:1:2']={blocks:[
{p:'Follow a change from the source database to the target. The same path applies to every replication.'},
{svg:flow},
{h:'The path'},
{flow:['The **Extract** reads the log and writes changes to a **local trail**','A **distribution path** reads the trail and sends it to the target deployment','The **Receiver Server** writes it to a **remote trail**','The **Replicat** reads the remote trail and applies changes to the target database','Checkpoints record progress so each process can restart exactly where it stopped']},
{h:'Roles in the path'},
{t:[['Piece','Where','Job'],
['**Extract**','Source deployment','Capture changes from the database log'],
['**Local trail**','Source','Holds captured changes'],
['**Distribution path**','Source (Distribution Server)','Send the trail to the target'],
['**Remote trail**','Target (Receiver Server)','Receives the trail data'],
['**Replicat**','Target deployment','Apply changes to the target database']]},
{h:'Why use a trail'},
{ul:['**Decoupling:** capture continues if the target is down. Changes wait in the trail.','**Restart:** nothing is lost if a process fails.','**Reuse:** one trail can feed several targets.']},
{note:'If the target is unavailable, the trail grows on the source. Watch disk space, so a long outage does not fill the file system.'}],
src:[['Data flow',O.GG]]};

/* ---------- 3: Checkpoints ---------- */
L['ora-gg:1:3']={blocks:[
{p:'**Checkpoints** are bookmarks. They record how far each process has read and written, so after a stop or a crash it can **continue without losing or repeating work**.'},
{t:[['Process','What the checkpoint records'],
['**Extract**','Where it reads in the database log, and where it writes in the trail'],
['**Distribution path**','The position in the trail it has sent'],
['**Replicat**','The position in the remote trail it has applied. Often also stored in the target database.']]},
{h:'How recovery works'},
{flow:['A process stops (error, restart, crash)','On restart it reads its checkpoint','It repositions to that point in the log or trail','It continues, and duplicate or missing changes are avoided']},
{h:'Look at checkpoints'},
{code:`OGG> INFO EXTRACT ext1, SHOWCH
OGG> INFO REPLICAT rep1, SHOWCH`},
{h:'Why this matters'},
{ul:['Transactions are applied **once and in order**, even across restarts.','Moving a process to a different position (repositioning) is a deliberate action, covered in the operations section.','If checkpoint data is lost, you may need to re-instantiate the target.']},
{note:'Back up deployment directories (including checkpoint and trail files) as part of your protection plan. They are part of the state of your replication.'}],
src:[['Checkpoints',O.GG]]};

/* ---------- 4: Web UI, Admin Client, REST ---------- */
L['ora-gg:1:4']={blocks:[
{p:'There are three ways to work with a deployment. They all do the same things. Pick the one that fits the task.'},
{t:[['Interface','Use for','Example'],
['**Web UI**','Learning, exploring, quick changes, dashboards','Open `https://host:port` in a browser'],
['**Admin Client**','Command-line work and scripts','`adminclient`'],
['**REST API**','Automation from programs and pipelines','`GET /services/v2/extracts`']]},
{h:'Admin Client'},
{code:`adminclient
OGG> CONNECT https://ggsrc.example.com:9011 DEPLOYMENT src_dep AS oggadmin PASSWORD <password>
OGG> INFO ALL
OGG> VIEW REPORT ext1
OGG> STOP EXTRACT ext1
OGG> HELP`},
{h:'REST API'},
{code:`curl -k -u oggadmin:<password> https://ggsrc.example.com:9011/services/v2/deployments
curl -k -u oggadmin:<password> https://ggsrc.example.com:9011/services/v2/extracts`},
{ul:['REST returns JSON, so scripts can read it.','Use HTTPS and a service account with limited rights.','Keep passwords out of scripts: use a vault or environment variables.']},
{flow:['Learn with the Web UI','Move repeating tasks to the Admin Client','Automate with REST in pipelines and monitoring','Protect credentials in every case']},
{note:'The Admin Client replaces GGSCI of the Classic architecture. Many commands have the same names, but the connection step is new.'}],
src:[['Admin Client and REST API',O.GG]]};

/* ---------- 5: Config Service and HA ---------- */
L['ora-gg:1:5']={blocks:[
{p:'**Availability of GoldenGate itself** matters. If the replication server fails, changes pile up in the source. In 23ai and later, a **Configuration Service** supports highly available deployments.'},
{h:'The idea'},
{t:[['Piece','Role'],
['**Configuration Service**','Keeps the deployment configuration in a shared place, so it is not tied to one host'],
['**Standby host**','A second host that can start the same deployment'],
['**Shared storage or replicated state**','Holds trails and checkpoints for failover']]},
{h:'What it gives you'},
{ul:['After a host failure, another host can take over the deployment with the same configuration.','Reduced manual work to restore settings.','A cleaner path to automation with Clusterware or other cluster managers.']},
{flow:['The deployment runs on host A','Configuration and state are kept in a shared service or storage','Host A fails','Host B starts the deployment from the shared configuration','Extract and Replicat continue from their checkpoints']},
{p:'Section 10 covers HA in detail. In earlier versions, high availability uses **Oracle Clusterware agents** or other cluster software around the deployment.'},
{note:'The features and names of the Configuration Service depend on the release. Check the documentation of your version for exact behaviour and requirements.'}],
src:[['GoldenGate high availability',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:1:6']={blocks:[
{p:'Take a tour of a running deployment. Use a lab GoldenGate (from section 3) or your instructor system. If you have none, read the steps now and repeat them after the installation section.'},
{h:'Step 1: Open the Web UI'},
{ul:['Open `https://host:port` (the Service Manager).','Log in with the deployment administrator.','Find the list of deployments.']},
{h:'Step 2: Find each service'},
{t:[['Look for','Where'],
['Administration Server','Process list: Extract and Replicat'],
['Distribution Server','Paths'],
['Receiver Server','Incoming paths'],
['Performance Metrics Server','Dashboards and lag']]},
{h:'Step 3: Admin Client'},
{code:`adminclient
OGG> CONNECT https://host:9011 DEPLOYMENT src_dep AS oggadmin PASSWORD <password>
OGG> INFO ALL
OGG> VIEW PARAMS ext1`},
{h:'Step 4: REST'},
{code:`curl -k -u oggadmin:<password> https://host:9011/services/v2/deployments`},
{h:'Check your understanding'},
{t:[['Question','Answer'],
['Which service starts the deployments?','Service Manager'],
['Which service sends a trail to another host?','Distribution Server'],
['Which service receives it?','Receiver Server'],
['Where are Extract and Replicat managed?','Administration Server'],
['Which tool replaces GGSCI?','Admin Client']]},
{note:'Do not change anything in a production deployment during this tour. Use only view and list commands.'}],
src:[['Microservices Architecture',O.GG]]};

})();
