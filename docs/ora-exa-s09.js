/* LearnSphere - Exadata, Section 09: Exadata in the Cloud & Multicloud.
   Lectures 0-6 are core, 7-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const layers=O.dg(700,250,[
[10,10,680,80,'You manage (in every model)',1],[30,40,200,40,'Databases, PDBs, users',0],[250,40,200,40,'Grid, patches (with tools)',0],[470,40,200,40,'Backups, DR, performance',0],
[10,110,680,60,'The VM cluster (guest VMs on the Exadata servers)',2],
[10,190,680,50,'Oracle manages: hardware, network, cells, hypervisor, firmware',1]],[]);

const where=O.dg(700,190,[
[10,30,150,70,'OCI region|Exadata DB Service|(Dedicated or Exascale)',2],[190,30,150,70,'Your data centre|Cloud@Customer|Oracle manages',2],[370,30,150,70,'Azure, AWS, Google|Oracle Database@|(Exadata in their DC)',2],[550,30,140,70,'Your data centre|Exadata Database|Machine (you manage)',0],
[10,120,680,55,'Same database and DBA skills: only the operator and location differ',1]],[]);

/* ---------- 0: Dedicated Infrastructure ---------- */
L['ora-exa:8:0']={blocks:[
{p:'**Exadata Database Service on Dedicated Infrastructure** (ExaDB-D) gives you an Exadata system inside Oracle Cloud (OCI) that is **dedicated to you**. Oracle runs the hardware. You run the databases.'},
{svg:layers},
{h:'The structure'},
{t:[['Object','Meaning'],
['**Exadata infrastructure**','The physical Exadata: database servers, storage servers, network. Created in the console.'],
['**VM cluster**','Guest VMs on the database servers that form a RAC cluster. You work here.'],
['**Database home and databases**','Oracle software and CDBs that run in the VM cluster']]},
{h:'What you get'},
{ul:['Real Exadata hardware, with Smart Scan, flash cache and all features.','Automatic management of infrastructure patches and hardware replacement.','Backups to Object Storage or a Recovery Appliance, Data Guard from the console.','Elastic scaling of CPUs in the VM cluster, with limits set by the infrastructure.']},
{t:[['Task','Who'],
['Replace a failed disk or power supply','Oracle'],
['Update storage servers and hypervisor','Oracle, in a scheduled window'],
['Patch Grid Infrastructure and databases','You, using console or tools'],
['Create databases, users, schemas','You'],
['Performance tuning','You']]},
{h:'Licensing'},
{p:'You can choose **License Included** (database licences are in the hourly price) or **Bring Your Own License** (BYOL) when you already own licences. Options such as RAC and Partitioning are included in the license-included model for the service.'},
{note:'Dedicated infrastructure has a minimum size (a base system). It suits large and consolidated workloads. Smaller workloads can use the Exascale option (next lecture).'}],
src:[['Exadata Database Service on Dedicated Infrastructure','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

/* ---------- 1: Exascale Infrastructure ---------- */
L['ora-exa:8:1']={blocks:[
{p:'**Exadata Database Service on Exascale Infrastructure** (ExaDB-XS) runs on the Exascale architecture from section 6. Storage is **shared** in a pool, so you can start small and pay for what you use.'},
{t:[['','Dedicated Infrastructure','Exascale Infrastructure'],
['**Hardware**','Dedicated to your tenancy','Shared pool run by Oracle'],
['**Minimum size**','A base system','Small VM clusters, small storage'],
['**Storage**','ASM disk groups on your cells','Exascale vaults in a shared pool'],
['**Scaling**','CPU, memory, storage within the infrastructure','Smaller steps, quick changes'],
['**Typical use**','Large production, strict isolation','Dev, test, small and medium production']]},
{h:'What you still manage'},
{ul:['Your VM cluster, databases, patches for your homes.','Your backups and Data Guard.','Your tuning and security settings.']},
{h:'Choose'},
{flow:['Need strict hardware isolation or very large size? Dedicated Infrastructure','Need a small start and elastic size? Exascale Infrastructure','Need data in your own data centre? Cloud@Customer','Need the database next to apps in another cloud? Oracle Database@ that cloud']},
{note:'Availability and details of each service vary by region and over time. Check the current service documentation before you plan a project.'}],
src:[['Exadata Database Service on Exascale Infrastructure','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

/* ---------- 2: Cloud@Customer ---------- */
L['ora-exa:8:2']={blocks:[
{p:'**Exadata Cloud@Customer (ExaC@C)** is Exadata hardware **in your data centre**, run by Oracle as a cloud service. It is for data that must stay on site (law, latency, policy) with cloud-style operations.'},
{h:'How it works'},
{t:[['Part','Where','Who'],
['**Exadata hardware**','Your data centre','Oracle owns and operates the infrastructure'],
['**Control plane**','Oracle Cloud','Oracle'],
['**VM clusters and databases**','On the hardware','You, using the cloud console or APIs'],
['**Data**','Stays in your data centre','You control access and policy']]},
{h:'Needs'},
{ul:['Network connection from the rack to Oracle Cloud for the control plane (outbound connection, no inbound access to your data).','Space, power, cooling and local network for the rack.','Backup targets: a local Recovery Appliance, NFS, or OCI Object Storage over the connection.']},
{flow:['Oracle delivers and installs the rack','It connects to the OCI control plane','You create VM clusters and databases from the console','Oracle maintains the infrastructure','Your data stays on site']},
{h:'Compared with on-premises Database Machine'},
{t:[['Task','Database Machine','Cloud@Customer'],
['Hardware and storage software patches','You','Oracle'],
['Provisioning','Manual tools','Console and APIs'],
['Billing','Purchase','Subscription']]},
{note:'Data stays on site, but the service depends on the connection to the control plane for management actions. Plan for how you will work if that link is down.'}],
src:[['Exadata Cloud@Customer','https://docs.oracle.com/en-us/iaas/exadata/index.html']]};

/* ---------- 3: Multicloud ---------- */
L['ora-exa:8:3']={blocks:[
{p:'Oracle Exadata hardware is also installed **inside the data centres of other clouds**. You manage it from that cloud console, and it connects to that cloud network. This is **Oracle Database@Azure, Oracle Database@AWS and Oracle Database@Google Cloud**.'},
{svg:where},
{t:[['Aspect','What it means'],
['**Location**','Oracle Exadata in the provider data centre, close to your applications there'],
['**Network**','Connected to your virtual network in that cloud, with low latency'],
['**Management**','From the provider portal and APIs, with OCI features also available'],
['**Billing**','Often through the provider marketplace'],
['**Database**','The same Oracle Database features and tools']]},
{h:'Why choose it'},
{ul:['Applications already run in that cloud and need Oracle Database with Exadata performance.','You want a single bill or committed spend with the provider.','You want to avoid sending large data volumes across clouds.']},
{h:'Things to check'},
{t:[['Check','Why'],
['Region availability','Not every region has the service'],
['Which services are offered (Exadata, Autonomous)','Differs by provider'],
['Network and identity setup','Needs planning with the provider network'],
['Support model','Who to call for what']]},
{note:'The same skills apply: SQL, RAC, ASM, Data Guard and tuning. The difference is where you click to create and scale.'}],
src:[['Oracle Database@Azure, @AWS, @Google Cloud','https://www.oracle.com/database/']]};

/* ---------- 4: Provisioning and scaling ---------- */
L['ora-exa:8:4']={blocks:[
{p:'Provisioning has the same order in every cloud Exadata service: **infrastructure**, **VM cluster**, **database home**, **database**. Scaling happens on the VM cluster.'},
{flow:['Create the Exadata infrastructure (or select the Exascale infrastructure)','Create the VM cluster: nodes, CPU, memory, storage, network, keys','Create a database home (software version)','Create the database (CDB with PDBs)','Create services, backups and Data Guard']},
{h:'VM cluster settings'},
{t:[['Setting','Notes'],
['**Database servers**','How many nodes (and which)'],
['**CPU and memory**','Per node, can be changed later'],
['**Local file system size**','For software and logs'],
['**Storage**','Space for DATA and RECO (ASM or Exascale vaults)'],
['**Network**','Client and backup subnets, SCAN names'],
['**SSH keys**','Your public key for access'],
['**License type**','License Included or BYOL'],
['**Grid Infrastructure version**','A supported release']]},
{h:'Scaling'},
{t:[['What','How','Impact'],
['**CPU**','Change the count in the console or API','Online, no restart'],
['**Memory**','Change the setting','Online (with VM adjustment)'],
['**Storage**','Increase the allocation','Online, ASM or vault resizes'],
['**Add or remove DB servers**','Scale the VM cluster nodes','Adds RAC nodes, takes some hours'],
['**Add storage servers**','Scale the infrastructure','Rebalance runs in the background']]},
{note:'In the cloud, scaling CPU back down saves money. Many teams scale up for month-end and scale down afterwards.'}],
src:[['Provisioning Exadata cloud infrastructure','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

/* ---------- 5: Backup and DR ---------- */
L['ora-exa:8:5']={blocks:[
{p:'Cloud Exadata offers **managed backup** and **managed disaster recovery** options. You choose them and configure the details.'},
{h:'Backup options'},
{t:[['Target','Notes'],
['**OCI Object Storage**','Automatic backups from the console, with a retention window. Backups are encrypted.'],
['**Recovery Appliance (Zero Data Loss Recovery Appliance)**','Real-time redo protection and incremental-forever backups. Common for large estates.'],
['**Your own RMAN scripts**','Allowed. You manage schedules and storage.']]},
{code:`# On a cloud VM, a command-line backup tool (check the current syntax)
dbaascli database backup --dbname orcl --start`},
{h:'Disaster recovery'},
{t:[['Option','Meaning'],
['**Data Guard association**','Create a standby database in another availability domain or region from the console'],
['**Switchover and failover**','Triggered from the console or API'],
['**Autonomous Data Guard**','Built into Autonomous Database (different service)']]},
{flow:['Choose a backup target and retention','Enable automatic backups','Create a standby in another region for site protection','Test a restore and a switchover']},
{h:'Rules'},
{ul:['Test restores. A backup that has never been restored is a hope.','Place the standby in a different fault domain or region.','Protect keys: Transparent Data Encryption wallets and keys are needed for restore.']},
{note:'The managed features save work, but the responsibility to test them stays with you. Schedule restore tests and DR drills like any other maintenance.'}],
src:[['Backup and Data Guard in Exadata Cloud','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

/* ---------- 6: Practical ---------- */
L['ora-exa:8:6']={blocks:[
{p:'**Walkthrough.** Provision an Exadata VM cluster in the cloud console. If you do not have a tenancy, follow the checklist and fill in the values for a case you choose. **Cloud resources cost money, so do not create them unless you are sure and are ready to delete them.**'},
{h:'Case'},
{p:'A company wants a two-node RAC for a production database of 4 TB, with backups to Object Storage and a standby in a second region.'},
{h:'Checklist'},
{t:[['Step','Choice'],
['Service','Dedicated Infrastructure (ExaDB-D) or Exascale (ExaDB-XS)'],
['Region and availability domain','Close to the application, a second region for the standby'],
['Infrastructure','Base shape with 2 database servers and 3 storage servers'],
['VM cluster','2 nodes, CPU and memory sized from today use plus growth'],
['Storage','DATA sized for 4 TB plus growth, RECO for backups and logs'],
['Network','Client subnet and backup subnet, SCAN names'],
['License','License Included or BYOL'],
['Database','CDB, PDBs for each application'],
['Backups','Object Storage, retention window, test restore'],
['DR','Data Guard association in the second region']]},
{h:'After creation, check'},
{code:`ssh opc@<node1>
sudo su - grid
crsctl check cluster -all
srvctl status database -db <dbname>
asmcmd lsdg`},
{t:[['Check','Expected'],
['`crsctl check cluster -all`','Online on both nodes'],
['`srvctl status database`','Both instances running'],
['`asmcmd lsdg`','DATA and RECO mounted'],
['Console backup status','Last backup completed'],
['Data Guard status','Standby synchronised']]},
{h:'Clean up'},
{ul:['Delete the database, the VM cluster and the infrastructure when finished.','Delete backups and standbys that you created.','Check the cost report to confirm that billing has stopped.']},
{note:'The aim is to know the order of the work and the settings you must decide. The console screens change over time, but the concepts do not.'}],
src:[['Exadata Cloud documentation','https://docs.oracle.com/en-us/iaas/exadatacloud/index.html']]};

})();
