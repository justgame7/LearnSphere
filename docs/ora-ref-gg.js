/* LearnSphere - GoldenGate Quick Reference (cheat sheet).
   window.QREF['ora-gg'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for Oracle GoldenGate Microservices Architecture (21c and later, 23ai and 26ai marked). Command and parameter names are the
   common ones; check the reference for your exact version (HELP in Admin Client, the Parameters reference, the REST API reference). */
window.QREF=window.QREF||{};
window.QREF['ora-gg']={title:'GoldenGate Quick Reference',blurb:'Services, files, parameters, commands, views, error messages and checklists for GoldenGate Microservices on one page each.',hint:'extract or lag',pages:[

/* 1 ---------------------------------------------------------------- services/processes */
{t:'Services and processes',d:'The services of a deployment and the replication processes, and where to look when one misbehaves.',see:[[1,0,'The five services'],[1,2,'The data flow']],b:[
{h:'Services'},
{t:[['Service','Role','Typical port'],
['Service Manager','Starts, stops and monitors deployments and their services','Set at install (for example 9001)'],
['Administration Server','Create and manage Extracts, Replicats, credentials, parameters','Set per deployment (for example 9011)'],
['Distribution Server','Sends trail data to remote Receiver Servers with paths','For example 9012'],
['Receiver Server','Receives trail data from a Distribution Server','For example 9013'],
['Performance Metrics Server','Collects and stores metrics','For example 9014 (plus a UDP port for metrics collection)']]},
{h:'Replication processes'},
{t:[['Process','Job','Look here'],
['Extract (integrated)','Captures changes through the database log mining server','`INFO EXTRACT`, report, `V$GOLDENGATE_CAPTURE`'],
['Extract (initial load)','Reads source tables for an initial copy','Report file'],
['Path (Distribution)','Sends a trail from source to target','Distribution Server UI, `INFO PATH`'],
['Replicat (parallel, integrated, coordinated, classic)','Reads a trail and applies to the target','`INFO REPLICAT`, report, discard file'],
['Collector / Receiver','Writes received data into a remote trail','Receiver Server']]},
{note:'Ports are chosen when you create the deployments. They are shown on the Service Manager home page and in the `oggca.sh` response file.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and directories',d:'What each directory of a deployment contains.',see:[[1,1,'Deployments and homes'],[4,1,'Trail files']],b:[
{t:[['Path','Contents'],
['`OGG_HOME`','Installed software (binaries), shared by deployments'],
['`OGG_ETC_HOME` / `etc`','Configuration of the deployment'],
['`etc/conf/ogg`','Parameter files (`*.prm`) for Extract and Replicat'],
['`OGG_VAR_HOME` / `var`','Variable data of the deployment'],
['`var/lib/data`','Trail files'],
['`var/lib/checkpt`','Checkpoint files (`*.cpe`, `*.cpr`) used for restart'],
['`var/lib/wallet` (credential store)','Encrypted database credentials (aliases)'],
['`var/log`','`ggserr.log` and service logs'],
['`var/lib/report`','Process report files (`*.rpt`)'],
['`var/lib/discard` (or the path in `DISCARDFILE`)','Discard files (`*.dsc`)'],
['`ServiceManager` home','Service Manager configuration and logs'],
['Reverse proxy configuration','NGINX or similar mapping to services']]},
{note:'Back up `etc`, the credential store and checkpoint files. Without checkpoints you must reposition processes by SCN or timestamp.'}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where each kind of event is recorded.',see:[[8,1,'Reports, logs and discard files'],[8,2,'Reading error messages']],b:[
{t:[['Log','Contains','Where'],
['`ggserr.log`','Process starts, stops, warnings and errors for the deployment','`var/log/ggserr.log`'],
['Process report','Parameters, statistics, errors of one Extract or Replicat (`EXT1.rpt`)','`var/lib/report`, UI: Details > Report'],
['Discard file','Records that failed to apply and why','`DISCARDFILE` path, `*.dsc`'],
['Service logs','Service Manager and service events','`var/log` of the Service Manager and deployment'],
['REST API log','Calls made through the REST API','Service log (restapi)'],
['Database alert log','Log mining server and capture errors','ADR `alert_<SID>.log`'],
['Performance Metrics','Lag, throughput, rate history','Performance Metrics Server UI']]},
{code:`-- Admin Client
VIEW REPORT EXT1
VIEW DISCARD REP1
INFO ALL
LAG EXTRACT EXT1
STATS EXTRACT EXT1, TOTAL, DAILY`}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'The Extract, Replicat and database parameters you set most.',see:[[5,0,'TABLE and MAP'],[4,0,'Integrated Extract']],b:[
{h:'Extract'},
{t:[['Parameter','Meaning'],
['`EXTRACT name`','Name the process'],
['`USERIDALIAS alias DOMAIN OracleGoldenGate`','Database credentials from the credential store'],
['`EXTTRAIL aa`','Local trail prefix (two characters)'],
['`TABLE schema.*;`','Tables to capture (in a PDB use `pdb.schema.table`)'],
['`TABLEEXCLUDE`','Exclude tables'],
['`DDL INCLUDE MAPPED`','Capture DDL for mapped objects'],
['`TRANLOGOPTIONS INTEGRATEDPARAMS (max_sga_size 1024, parallelism 4)`','Log mining server settings'],
['`WARNLONGTRANS 1H, CHECKINTERVAL 5M`','Warn about long open transactions'],
['`LOGALLSUPCOLS`, `UPDATERECORDFORMAT COMPACT`','Capture supplemental columns and format updates'],
['`REPORTCOUNT EVERY 5 MINUTES, RATE`','Periodic statistics in the report']]},
{h:'Replicat'},
{t:[['Parameter','Meaning'],
['`REPLICAT name`','Name the process'],
['`MAP src.*, TARGET tgt.*;`','Mapping source to target'],
['`DBOPTIONS INTEGRATEDPARAMS(parallelism 4)`','Integrated Replicat apply settings'],
['`APPLY_PARALLELISM`, `MIN_/MAX_APPLY_PARALLELISM`','Parallel Replicat apply threads'],
['`BATCHSQL`','Batch similar statements'],
['`REPERROR (DEFAULT, ABEND)`, `REPERROR (1403, DISCARD)`','Error handling rules'],
['`HANDLECOLLISIONS`','Tolerate missing and duplicate rows during initial load catch-up (turn off after)'],
['`DISCARDFILE path, APPEND, MEGABYTES 100`','Record failed operations'],
['`MAXTRANSOPS`, `SPLIT_TRANS_RECS`','Break up large transactions'],
['`ASSUMETARGETDEFS`','Source and target structures are identical']]},
{h:'Database parameters'},
{t:[['Parameter','Typical'],
['`enable_goldengate_replication`','`TRUE` (source and target)'],
['`streams_pool_size`','Sized for integrated capture and apply, or leave to automatic SGA'],
['`compatible`','At least the level required by the GoldenGate release'],
['Supplemental logging','`ALTER DATABASE ADD SUPPLEMENTAL LOG DATA;` plus table or schema level']]}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'Database views and Admin Client status',d:'Which view or command answers which GoldenGate question.',see:[[3,2,'Supplemental logging'],[8,0,'Dashboards and alerts']],b:[
{t:[['Question','View or command'],
['Is a table supported for integrated capture?','`DBA_GOLDENGATE_SUPPORT_MODE`'],
['Who has GoldenGate privileges?','`DBA_GOLDENGATE_PRIVILEGES`'],
['Is capture running, how far is it?','`V$GOLDENGATE_CAPTURE`'],
['Open transactions seen by capture','`V$GOLDENGATE_TRANSACTION`'],
['Apply side activity','`V$GG_APPLY_COORDINATOR`, `V$GG_APPLY_READER`, `V$GG_APPLY_SERVER`'],
['Capture and apply definitions','`DBA_CAPTURE`, `DBA_APPLY`'],
['Supplemental logging state','`V$DATABASE` (`SUPPLEMENTAL_LOG_DATA_MIN`, `..._PK`, `..._ALL`), `DBA_LOG_GROUPS`'],
['Which Extracts and Replicats exist?','`INFO ALL`'],
['Process detail and checkpoints','`INFO EXTRACT EXT1, DETAIL`, `INFO REPLICAT REP1, SHOWCH`'],
['Lag now','`LAG EXTRACT EXT1`, `LAG REPLICAT REP1`'],
['Statistics','`STATS EXTRACT EXT1, TOTAL`'],
['Credential store contents','`INFO CREDENTIALSTORE`'],
['Heartbeat lag','Heartbeat table views `GG_LAG`, `GG_HEARTBEAT_HISTORY`']]}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'Admin Client and REST commands',d:'The commands used to build and run a replication, in the order you use them.',see:[[2,2,'oggca and deployments'],[4,0,'Integrated Extract']],b:[
{h:'Build a one-way replication (Admin Client)'},
{code:`CONNECT https://host:9011 DEPLOYMENT src AS oggadmin PASSWORD ******
DBLOGIN USERIDALIAS srcdb DOMAIN OracleGoldenGate
ADD SCHEMATRANDATA pdb1.shop ALLCOLS
REGISTER EXTRACT ext1 DATABASE CONTAINER (pdb1)
ADD EXTRACT ext1, INTEGRATED TRANLOG, BEGIN NOW
ADD EXTTRAIL aa, EXTRACT ext1
START EXTRACT ext1

-- target
DBLOGIN USERIDALIAS tgtdb DOMAIN OracleGoldenGate
ADD REPLICAT rep1, PARALLEL, EXTTRAIL ab, CHECKPOINTTABLE ggadmin.chkpt
START REPLICAT rep1, ATCSN 1234567`},
{t:[['Command','Use'],
['`INFO ALL`','State of all processes'],
['`INFO EXTRACT ext1, DETAIL`','Details, trail, checkpoint position'],
['`STOP / START / KILL EXTRACT ext1`','Control'],
['`ALTER EXTRACT ext1, BEGIN <timestamp>`','Reposition by time'],
['`ALTER REPLICAT rep1, EXTSEQNO 12, EXTRBA 0`','Reposition in a trail'],
['`DELETE EXTRACT ext1`','Remove (after unregistering)'],
['`UNREGISTER EXTRACT ext1 DATABASE`','Remove capture from the database'],
['`ADD CREDENTIALSTORE`, `ALTER CREDENTIALSTORE ADD USER ... ALIAS ...`','Credential aliases'],
['`ADD HEARTBEATTABLE`','Create heartbeat objects for end-to-end lag'],
['`SEND EXTRACT ext1, STATUS`','Ask a running process for status'],
['`VIEW PARAMS ext1`, `EDIT PARAMS ext1`','Parameter file']]},
{note:'Syntax differs a little between versions. Use `HELP <command>` in the Admin Client and the REST API reference of your release for the exact form.'}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Which Extract, which Replicat, which load method and which topology.',see:[[4,0,'Integrated Extract'],[4,2,'Replicat types']],b:[
{h:'Extract type'},
{t:[['Type','Use'],
['Integrated Extract (database log mining)','Oracle source, default and recommended'],
['Classic Extract','Older releases or non-Oracle sources only; where integrated is not supported'],
['Initial load Extract','One-time copy of existing data'],
['Pump (path)','Move trail data between servers']]},
{h:'Replicat type'},
{t:[['Type','Use'],
['Parallel Replicat','Default for high throughput, dependency-aware apply'],
['Integrated Replicat','Oracle target, uses the database apply server'],
['Coordinated Replicat','Split work by tables or ranges (older approach)'],
['Classic Replicat','Simple or non-Oracle targets']]},
{h:'Initial load method'},
{t:[['Method','Use'],
['Data Pump with SCN (`FLASHBACK_SCN`)','Oracle to Oracle, most common'],
['GoldenGate initial load Extract and Replicat','Heterogeneous targets'],
['RMAN duplicate or Data Guard then switch to GG','Very large Oracle databases (specific cases)'],
['Database native tools','Non-Oracle targets']]},
{h:'Topology'},
{t:[['Need','Use'],
['Migration or upgrade','One-way with reverse replication for fallback'],
['Reporting copy','One-way, filtered'],
['Active-active','Bidirectional with conflict detection and loop prevention'],
['One to many','Hub and spoke'],
['Consolidation','Many to one']]},
{h:'Supplemental logging level'},
{t:[['Level','What to add'],
['Minimal (database)','Always: `ADD SUPPLEMENTAL LOG DATA`'],
['Schema level','`ADD SCHEMATRANDATA` for schemas to be captured'],
['Table level','`ADD TRANDATA` for tables not in schema scope, with key or all columns']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[8,2,'Reading error messages'],[8,6,'Five broken replications']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Extract ABENDED at start','Report, `ggserr.log`','Not registered, privileges, supplemental logging','`REGISTER EXTRACT`, grant privileges, add trandata'],
['Replicat ABENDED, discard has rows','Discard file, ORA error','Missing row (ORA-01403), duplicate (ORA-00001), constraint','`REPERROR`, repair data, handle collisions, reposition'],
['Lag grows at capture','`LAG EXTRACT`, `V$GOLDENGATE_CAPTURE`','Long transaction, redo volume, log mining memory','Check `WARNLONGTRANS`, `max_sga_size`, parallelism'],
['Lag grows at apply','`INFO REPLICAT`, apply views','Slow target, large transactions, no batching','Parallel Replicat, `BATCHSQL`, indexes on target'],
['Lag grows at network','Path state, bandwidth','Latency or limited bandwidth','Compression, TCP tuning'],
['No data at target but running','`STATS`, mapping','Wrong `TABLE` or `MAP`, filter','Fix parameters, restart'],
['Path stops, certificate error','Distribution log, certificate dates','Expired or wrong certificate','Renew and update'],
['ORA-01291 missing log file','Archived log availability','Logs deleted before capture read them','Restore the log, change deletion policy'],
['Trail disk full','`df`, trail purge settings','No purge, slow consumers','Purge policy, extend space, fix slow Replicat'],
['Cannot connect to service','Reverse proxy, ports, firewall','Proxy mapping or service down','Check Service Manager, certificates'],
['Data differs','Veridata or count and checksum','Collisions hidden, missed DDL','Compare, repair, review DDL handling']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'Messages and database errors seen most often, with first action.',see:[[8,2,'Reading error messages'],[8,3,'Restarting and repositioning']],b:[
{t:[['Message','Meaning','First action'],
['ORA-01403','No data found: target row missing for an update or delete','Check discard file; initial load or resync'],
['ORA-00001','Unique constraint violated on apply','Duplicate or collision; handle collisions or fix data'],
['ORA-01291','Missing log file','Restore archived log, check retention'],
['ORA-01031','Insufficient privileges (database user)','Grant GoldenGate privileges (`DBMS_GOLDENGATE_AUTH`)'],
['ORA-26687','Instantiation SCN not set','Use `START REPLICAT ... ATCSN` or set instantiation'],
['ORA-26786 / 26787','Row exists with conflicting columns / row does not exist','Conflict detection or data difference'],
['ORA-00060','Deadlock on apply','Parallelism and ordering; retry settings'],
['ORA-01555','Snapshot too old during capture or initial load','Increase undo retention'],
['OGG-00664','OCI error beginning session','Check credentials and connectivity'],
['OGG-01154','SQL error mapping a record','Read the ORA code inside the message'],
['OGG-01163','Bad column index in a mapping','Source and target definitions differ'],
['OGG-01168','Update without all key columns','Add key columns or supplemental logging'],
['OGG-01296','Error mapping source column to target','Check column mapping and types'],
['OGG-02022','Log mining server does not exist','Re-register the Extract']]},
{note:'Read the complete message text in `ggserr.log` and the report, not only the number. The same OGG code can have different details.'}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check pack',d:'Admin Client and SQL checks for the daily review.',see:[[8,0,'Dashboards and alerts'],[12,1,'Sizing, monitoring and alerting']],b:[
{h:'Admin Client'},
{code:`INFO ALL
LAG EXTRACT *
LAG REPLICAT *
STATS EXTRACT ext1, LATEST
INFO PATH *
INFO CREDENTIALSTORE`},
{h:'Capture (source database)'},
{code:`SELECT capture_name, state, total_messages_captured, capture_time, enqueue_message_create_time
FROM v$goldengate_capture;

SELECT xidusn, xidslt, xidsqn, cumulative_message_count, first_message_time
FROM v$goldengate_transaction ORDER BY first_message_time FETCH FIRST 10 ROWS ONLY;`},
{h:'Supplemental logging and archived logs'},
{code:`SELECT supplemental_log_data_min, supplemental_log_data_pk, supplemental_log_data_all, force_logging FROM v$database;
SELECT name, value FROM v$parameter WHERE name = 'enable_goldengate_replication';`},
{h:'Apply (target database)'},
{code:`SELECT apply_name, state, total_applied, total_errors FROM v$gg_apply_coordinator;
SELECT * FROM dba_apply_error ORDER BY error_creation_time DESC FETCH FIRST 10 ROWS ONLY;`},
{h:'Host'},
{code:`df -h /u01/ogg/var/lib/data
ls -ltr /u01/ogg/var/log | tail
tail -50 /u01/ogg/var/log/ggserr.log`}
]},

/* 11 ---------------------------------------------------------------- naming decoder */
{t:'Naming decoder',d:'How trails, processes, paths and checkpoints are named.',see:[[4,1,'Trail files'],[1,1,'Deployments']],b:[
{t:[['Item','Looks like','Meaning'],
['Trail prefix','`aa`','Two characters you choose when adding the trail'],
['Trail file','`aa000000012`','Prefix plus sequence number (9 digits)'],
['Trail position','`SEQNO 12, RBA 3817`','Trail sequence and byte offset'],
['Extract name','`EXT1`, `EXTSHOP`','Up to eight characters'],
['Replicat name','`REP1`','Up to eight characters'],
['Path name','`src_to_tgt`','Distribution path from source to target'],
['Credential alias','`srcdb`','Name for stored credentials, used in `USERIDALIAS`'],
['Domain','`OracleGoldenGate`','Credential store domain'],
['Checkpoint files','`EXT1.cpe`, `REP1.cpr`','Extract and Replicat restart positions'],
['Report file','`EXT1.rpt`, `EXT1_0.rpt`','Current and aged reports'],
['Discard file','`REP1.dsc`','Failed operations'],
['SCN / CSN','`1234567`','Commit sequence number used in `ATCSN`, `AFTERCSN`'],
['Deployment','`src`, `tgt`','A set of services and a home inside Service Manager'],
['Heartbeat table','`GG_HEARTBEAT`, `GG_LAG`','End-to-end lag measurement objects'],
['REST path','`/services/v2/extracts/EXT1`','Resource in the REST API']]}
]},

/* 12 ---------------------------------------------------------------- security/HA */
{t:'Security and HA checklist',d:'A short checklist for a deployment before go-live.',see:[[9,0,'TLS and certificates'],[9,3,'High availability']],b:[
{t:[['Area','Check'],
['Transport','HTTPS on all services and `wss://` for distribution paths'],
['Identity','Named users with roles (Security, Administrator, Operator, User), no shared admin'],
['Secrets','Credentials only in the credential store, no passwords in parameter files or scripts'],
['Certificates','Expiry dates tracked and alerts at 30 and 7 days'],
['Network','Services behind a reverse proxy, only needed ports open'],
['Database user','Least privilege, separate source and target GoldenGate users'],
['Trail files','File permissions restricted, encryption if required'],
['Backup','Deployment `etc`, wallet, checkpoints backed up and restore tested'],
['HA','Clusterware agent or Configuration Service, failover tested'],
['DR','Replication layer documented in the DR plan'],
['Monitoring','State, lag, discard, trail disk and certificate alerts routed to on-call']]}
]},

/* 13 ---------------------------------------------------------------- versions */
{t:'Versions and architecture notes',d:'Which architecture and which release you are likely to meet, and what changed.',see:[[0,4,'Versions'],[1,5,'Configuration Service']],b:[
{t:[['Item','Note'],
['Microservices Architecture','The current architecture: services with REST API and Web UI'],
['Classic Architecture','Older GGSCI-based deployments; deprecated and removed in newer releases. Plan migration.'],
['19c','Last release that was widely used in classic mode; supports microservices too'],
['21c, 23ai, 26ai','Microservices Architecture; feature additions (Configuration Service, new targets, AI related). Check release notes.'],
['Configuration Service','High availability for deployment configuration (23ai and later)'],
['Veridata','Separate product for comparing and repairing data'],
['OCI GoldenGate','Managed service, you create connections and deployments'],
['Licensing','Per-core licence or service-based; check for your use']]},
{note:'Version support and feature lists change. Read the release notes of the exact version before upgrading GoldenGate or the database it replicates.'}
]}

]};
