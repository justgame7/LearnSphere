/* LearnSphere - GoldenGate, Section 10: Security & High Availability.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const sec=O.dg(700,230,[
[10,10,680,210,'Layers of protection around GoldenGate',1],
[30,45,200,50,'Network|firewall, TLS between hosts',0],[250,45,200,50,'Access|users, roles, OAuth|',0],[470,45,200,50,'Secrets|credential store|no passwords in files',0],
[30,115,200,50,'Files|trails and logs protected|(OS permissions, encryption)',0],[250,115,200,50,'Audit|who changed what|and when',0],[470,115,200,50,'Updates|patch regularly',0],
[30,180,640,28,'Defence in depth: each layer helps even when another fails',2]],[]);

const ha=O.dg(700,190,[
[10,20,300,160,'Host A (active)',1],[30,55,260,40,'Deployment running',2],[30,110,260,50,'Extract / Replicat continue|from checkpoints',0],
[390,20,300,160,'Host B (standby)',1],[410,55,260,40,'Same deployment, stopped',0],[410,110,260,50,'Starts on failure of host A|(clusterware or HA service)',2],
[310,85,80,40,'shared state',0]],
[[290,75,310,105],[390,105,410,75]]);

/* ---------- 0: TLS ---------- */
L['ora-gg:9:0']={blocks:[
{p:'Replication moves business data across networks. It must be **encrypted** and the parties must be **authenticated**. In Microservices Architecture, this is done with **TLS** and **certificates**.'},
{svg:sec},
{h:'What needs TLS'},
{t:[['Connection','Use'],
['**Browser or client to a service**','HTTPS to the Web UI, Admin Client and REST API'],
['**Distribution path to Receiver Server**','`wss://` between deployments'],
['**Service to database**','Oracle Net encryption or TLS (a database setting)']]},
{h:'Certificates'},
{ul:['Each deployment has a **server certificate** in a wallet (`OGG_SSL_HOME`).','Clients and servers trust the **certificate authority (CA)** that signed them.','For paths between deployments, the sending side trusts the receiving certificate, and can also present a client certificate for **mutual TLS**.']},
{code:`OGG> CREATE WALLET   (managed in the deployment security settings)
-- Typical flow in the Web UI or REST: import the CA certificate into the deployment wallet
-- then create the distribution path with a wss:// target`},
{h:'Rules'},
{flow:['Get a server certificate from your CA for each deployment (or the reverse proxy)','Install it and the CA chain in the wallet or proxy','Use wss:// for every path that crosses a network','Monitor certificate expiry and renew in time']},
{note:'An expired certificate stops a distribution path. Put certificate dates in your calendar or monitoring, and test renewal in a lab.'}],
src:[['GoldenGate security',O.GG]]};

/* ---------- 1: Authentication and roles ---------- */
L['ora-gg:9:1']={blocks:[
{p:'Not everyone who uses GoldenGate should be able to change it. **Roles** limit what each user can do.'},
{t:[['Role','Can'],
['**Security**','Manage users, roles and security settings'],
['**Administrator**','Change configuration, create and edit processes'],
['**Operator**','Start, stop, and restart processes, view status'],
['**User**','View status and information only']]},
{h:'How users sign in'},
{t:[['Method','Notes'],
['**Local users**','Created in the deployment. Simple. Needs password policy.'],
['**OAuth / OIDC (identity provider)**','Sign in with the company identity system (for example Active Directory or a cloud IAM). Single sign-on and central control.']]},
{h:'Good practice'},
{ul:['Replace the first administrator for daily use. Use **named accounts**, one per person.','Give each person the **least role** they need.','Use OAuth or your identity provider for centralised control and offboarding.','Use service accounts for scripts, with the Operator or User role where possible.']},
{flow:['List who does what with GoldenGate','Map each person to a role','Create named accounts or connect the identity provider','Review roles every quarter and remove leavers']},
{note:'A shared administrator account makes auditing meaningless. Named accounts show who made a change.'}],
src:[['Users and roles',O.GG]]};

/* ---------- 2: Credential store ---------- */
L['ora-gg:9:2']={blocks:[
{p:'GoldenGate needs **database passwords** to connect. The **credential store** keeps them encrypted, and parameter files refer to an **alias**, never the password.'},
{code:`OGG> ALTER CREDENTIALSTORE ADD USER c##ggadmin@srccdb PASSWORD <password> ALIAS src_alias DOMAIN OracleGoldenGate
OGG> INFO CREDENTIALSTORE DOMAIN OracleGoldenGate
OGG> DBLOGIN USERIDALIAS src_alias DOMAIN OracleGoldenGate

-- In a parameter file
USERIDALIAS src_alias DOMAIN OracleGoldenGate`},
{t:[['Item','Notes'],
['**Alias**','A name you use in parameter files'],
['**Domain**','A group of aliases (for example OracleGoldenGate)'],
['**Storage**','Encrypted in the deployment']]},
{h:'Rules'},
{ul:['Never put a password in a parameter file, script or command line.','Use a **different password** for each environment and rotate regularly.','To rotate: change the database password, then update the alias in the credential store, then restart the processes.','Limit who can read the deployment directories.']},
{h:'Other secrets'},
{t:[['Secret','Where to keep it'],
['REST API password in scripts','A vault or environment variable'],
['Certificate private keys','The wallet, with restricted file permissions'],
['Identity provider client secrets','The security settings of the deployment']]},
{flow:['Put every database credential in the credential store','Use aliases everywhere','Rotate on a schedule','Check that no password appears in files or shell history']},
{note:'Search your parameter files and scripts for plain passwords. Finding them is a common result of a first security review.'}],
src:[['Credential store',O.GG]]};

/* ---------- 3: HA ---------- */
L['ora-gg:9:3']={blocks:[
{p:'If the GoldenGate host fails, changes pile up in the source log and replication stops. **High availability** lets another host take over quickly.'},
{svg:ha},
{h:'Options'},
{t:[['Option','How'],
['**Configuration Service** (23ai and later)','Deployment configuration is kept in a shared place so another host can start the same deployment'],
['**Oracle Clusterware agents (XAG)**','Cluster software starts, stops and moves the deployment between nodes, with a virtual IP'],
['**Other cluster managers**','Pacemaker or similar, with shared storage'],
['**Container orchestrators**','Restart the deployment on another node, with a persistent volume']]},
{h:'What must be shared'},
{ul:['The **deployment directories**: configuration, checkpoints and trails. Use shared storage or replicated storage.','A **virtual IP or name**, so connecting paths and users find the active host.','The **credential store** and wallets.']},
{flow:['Run GoldenGate under a cluster manager','Keep deployment data on shared, protected storage','Test a failover: stop the active host and see processes resume from checkpoints','Check lag recovers']},
{note:'Failover resumes from checkpoints, so no change is lost. The effect is a short pause in replication, then catch-up.'}],
src:[['High availability for GoldenGate',O.GG]]};

/* ---------- 4: Backup and recovery ---------- */
L['ora-gg:9:4']={blocks:[
{p:'GoldenGate has state that you must be able to **restore**: configuration, checkpoints, trails, wallets.'},
{t:[['Back up','Why'],
['**OGG_HOME** (software)','Rebuild after a loss (or reinstall from media)'],
['**Deployment directories** (etc, conf, ssl)','Configuration, parameter files, certificates'],
['**Checkpoint files and checkpoint tables**','Positions of processes'],
['**Trail files**','Changes not yet applied (if long-lived)'],
['**Credential store and wallets**','Needed to reconnect to databases and between deployments']]},
{h:'How'},
{ul:['Back up while processes are stopped, or use storage snapshots that are consistent.','Keep the backups outside the host, and test restores.','Document the restore steps: reinstall, restore directories, start the Service Manager, start processes.']},
{h:'Recovery cases'},
{t:[['Case','Action'],
['Process definition lost','Recreate from saved parameter files'],
['Checkpoint lost','Reposition from a known SCN or trail position, check data'],
['Trails lost','Re-extract from the source logs (if archive logs remain) or re-instantiate'],
['Host lost','Restore on a new host or fail over to the standby deployment']]},
{flow:['Define what to back up and how often','Take backups and copy them off host','Test a restore in a lab','Update the plan when you change the setup']},
{note:'Version-control parameter files and scripts. Together with a backup of checkpoints and wallets, they let you rebuild a deployment quickly.'}],
src:[['Backup and recovery of GoldenGate',O.GG]]};

/* ---------- 5: DR ---------- */
L['ora-gg:9:5']={blocks:[
{p:'The **replication layer** needs a disaster recovery plan, just like the databases. What if the whole GoldenGate site is lost?'},
{h:'Scenarios'},
{t:[['Scenario','Impact','Plan'],
['**Source site lost**','Replication source gone','Fail over the source database (Data Guard), then re-point or recreate Extract on the new primary'],
['**GoldenGate hub lost**','Processes stopped, trails may be lost','Restore the deployment on another host, or start the DR deployment'],
['**Target lost**','Replicat cannot apply','Wait, or re-point to a new target, then re-instantiate if needed']]},
{h:'Extract and Data Guard'},
{ul:['Run Extract against a **Data Guard** primary. After a switchover or failover, the new primary needs the Extract: create it there, or use a design that supports role transitions (for example Extract from the standby in a supported configuration).','Keep archived logs available after failover, so Extract can read from its last position.','Test the whole chain in a drill.']},
{flow:['List failure scenarios for source, hub and target','Decide the recovery for each','Write the runbook with exact steps','Run a drill and record the times']},
{note:'DR for replication is easy to forget. The business sees "the data is not arriving", and it counts as an outage of the whole service.'}],
src:[['GoldenGate and disaster recovery',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:9:6']={blocks:[
{p:'**Secure** a deployment and **fail over** a deployment in your lab.'},
{h:'Part 1: Secure it'},
{flow:['Check that all services use HTTPS','Replace the first administrator for daily work with a named account','Create an Operator account for a script','Store the database passwords only in the credential store','Check that no plain password exists in parameter files or scripts']},
{code:`grep -ri "password" /u01/ogg/deployments/src_dep/etc/conf/ 2>/dev/null
OGG> INFO CREDENTIALSTORE DOMAIN OracleGoldenGate`},
{h:'Part 2: Fail over'},
{flow:['Copy the deployment directories to a second host (or use shared storage)','Stop the deployment on host A (or power it off in the lab)','Start the Service Manager and deployment on host B','Check that Extract and Replicat resume from their checkpoints','Check that lag returns to normal']},
{code:`# Host B
$OGG_HOME/bin/... start the Service Manager and the deployment as documented
OGG> INFO ALL
OGG> LAG REPLICAT rep1`},
{h:'Check your result'},
{t:[['Check','Expected'],
['No plain passwords','None found'],
['Roles','Daily user is not the first administrator'],
['After failover','Processes RUNNING on host B'],
['Data','No gaps or duplicates (compare counts)'],
['Time','Your measured recovery time']]},
{note:'Write down the failover time. It is part of your RTO for the replication layer.'}],
src:[['Securing and protecting GoldenGate',O.GG]]};

})();
