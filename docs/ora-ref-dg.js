/* LearnSphere - Data Guard Quick Reference (cheat sheet).
   window.QREF['ora-dg'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Values are for Oracle Data Guard 19c on Linux unless stated; 26ai additions are marked [26ai].
   Check broker property names with SHOW DATABASE VERBOSE <db> in DGMGRL on your release. */
window.QREF=window.QREF||{};
window.QREF['ora-dg']={title:'Data Guard Quick Reference',blurb:'Processes, files, parameters, broker properties, views, role transitions and fixes on one page each.',hint:'lag or switchover',pages:[

/* 1 ---------------------------------------------------------------- processes */
{t:'Processes',d:'Every process that moves or applies redo, and where to look when lag appears.',see:[[1,1,'LNS, ARCn, RFS and MRP'],[1,0,'The full flow']],b:[
{t:[['Process','Where','Job','Look here'],
['LGWR','Primary','Writes redo and, with SYNC, hands it to the transport','`V$LOG`'],
['LNS / NSSn / NSAn','Primary','Network server: ships redo to the standby (SYNC: NSS, ASYNC: NSA)','`V$DATAGUARD_PROCESS`, `V$ARCHIVE_DEST_STATUS`'],
['ARCn','Primary','Ships archived logs, fills gaps (FAL)','`V$ARCHIVE_DEST`'],
['RFS','Standby','Remote file server: receives redo from the primary and writes to standby redo logs','`V$MANAGED_STANDBY`'],
['MRP0','Standby','Managed recovery: applies redo to the physical standby','`V$MANAGED_STANDBY`, `V$DATAGUARD_PROCESS`'],
['PRnn','Standby','Parallel recovery slaves for apply','`V$RECOVERY_PROGRESS`'],
['LSP0, LSPnn','Logical standby','SQL Apply coordinator and workers','`V$LOGSTDBY_PROCESS`'],
['DMON','Both','Broker monitor process','`DG_BROKER_START`, `drc<SID>.log`'],
['NSVn, DRCn','Both','Broker network server and worker processes','Broker log'],
['Observer','Third host','Monitors the primary and standby for Fast-Start Failover','`DGMGRL> SHOW OBSERVER`'],
['FAL client','Standby','Fetches missing logs (`FAL_SERVER`)','Standby alert log']]},
{note:'`V$DATAGUARD_PROCESS` (12.2 and later) replaces the older `V$MANAGED_STANDBY` for most checks, and it shows both transport and apply.'}
]},

/* 2 ---------------------------------------------------------------- files */
{t:'Files and what they hold',d:'Files that exist only because of Data Guard, or that must be in step across sites.',see:[[2,2,'Standby redo logs'],[4,0,'Broker configuration files']],b:[
{t:[['File','Contents','Note'],
['Standby redo logs (SRL)','Received redo, before apply','One more group per thread than online groups; same size as online logs'],
['Standby control file','Control file made `FOR STANDBY`','Created by `RMAN DUPLICATE` or `ALTER DATABASE CREATE STANDBY CONTROLFILE`'],
['Broker configuration files','`dr1<db>.dat`, `dr2<db>.dat`','`DG_BROKER_CONFIG_FILE1/2`, in ASM for RAC'],
['Password file','Admin users for redo transport authentication','Must match across the configuration (copy, or `orapwd` with same SYS password)'],
['SPFILE','Different parameters per role','Keep standby-only parameters documented'],
['Wallet (TDE)','Master key','Same keys needed on every site'],
['Archived redo logs','Transport source and fallback','Deletion policy `APPLIED ON ALL STANDBY`'],
['Observer configuration','`observer.ora`, wallet, log','On the observer host'],
['`tnsnames.ora` and listeners','Static entries for DGMGRL','Static registration for restart ability']]},
{h:'Standby redo log sizing'},
{code:`-- groups = (number of online groups per thread) + 1, same size as online logs
ALTER DATABASE ADD STANDBY LOGFILE THREAD 1 GROUP 11 SIZE 1G;
SELECT group#, thread#, bytes/1048576 mb, status FROM v$standby_log;`}
]},

/* 3 ---------------------------------------------------------------- logs */
{t:'Log files and where to find them',d:'Where the story of a lag or a failed role change is written.',see:[[10,0,'Monitoring lag'],[4,4,'VALIDATE DATABASE']],b:[
{t:[['Log','Contains','Where'],
['Primary alert log','Transport errors, destination status, switchover messages','`.../trace/alert_<SID>.log`'],
['Standby alert log','RFS and MRP messages, gaps, apply progress','`.../trace/alert_<SID>.log` on the standby'],
['Broker log','Broker actions and errors (`drc<SID>.log`)','Same trace directory'],
['Observer log','FSFO decisions, reconnect, failover','`observer.log` or the file named at start'],
['DGMGRL history','Commands entered','Console, or `-logfile`'],
['MRP trace','Apply details','`<SID>_mrp0_<pid>.trc`'],
['`V$DATAGUARD_STATUS`','Recent Data Guard messages as rows','Query on either site'],
['`V$ARCHIVE_DEST_STATUS`','Destination state and errors','Primary']]},
{code:`SELECT timestamp, severity, facility, message
FROM v$dataguard_status WHERE timestamp > SYSDATE - 1/24 ORDER BY timestamp;`}
]},

/* 4 ---------------------------------------------------------------- parameters */
{t:'Important parameters',d:'Initialization parameters and archive destination attributes for Data Guard.',see:[[2,3,'db_unique_name and log_archive_config'],[1,3,'SYNC vs ASYNC']],b:[
{h:'Initialization parameters'},
{t:[['Parameter','Typical','Note'],
['`db_unique_name`','Different per site','Required, unique in the configuration'],
['`log_archive_config`','`DG_CONFIG=(prim,stby)`','Lists all members'],
['`log_archive_dest_n`','`SERVICE=stby ASYNC VALID_FOR=(ONLINE_LOGFILES,PRIMARY_ROLE) DB_UNIQUE_NAME=stby`','Remote destination (broker manages when enabled)'],
['`log_archive_dest_state_n`','`ENABLE`','Use `DEFER` to pause shipping'],
['`fal_server`','TNS name of primary','Where the standby fetches gaps'],
['`standby_file_management`','`AUTO`','New datafiles created on standby automatically'],
['`db_file_name_convert`, `log_file_name_convert`','Paths','Only when paths differ (not with OMF/ASM)'],
['`dg_broker_start`','`TRUE`','Run DMON'],
['`dg_broker_config_file1/2`','Shared location','For RAC, put in ASM'],
['`log_archive_max_processes`','4 or higher','Archiver processes'],
['`archive_lag_target`','0 or seconds','Force log switch to limit loss for ASYNC'],
['`db_lost_write_protect`','`TYPICAL`','Detect lost writes (primary and standby)'],
['`db_flashback_retention_target`','Per policy','Needed to reinstate'],
['`enabled_pdbs_on_standby`','`*` or a list','Which PDBs the standby holds (CDB standby)']]},
{h:'LOG_ARCHIVE_DEST_n attributes'},
{t:[['Attribute','Meaning'],
['`SERVICE`','TNS alias of the standby'],
['`SYNC` / `ASYNC`','Wait for the standby, or not'],
['`AFFIRM` / `NOAFFIRM`','Standby write confirmation before acknowledging'],
['`NET_TIMEOUT`','Seconds to wait for a SYNC destination before giving up'],
['`VALID_FOR`','When the destination applies (log type, role)'],
['`DB_UNIQUE_NAME`','Target database'],
['`COMPRESSION`','`ENABLE` (needs Advanced Compression)'],
['`MAX_FAILURE`, `REOPEN`','Retry behavior'],
['`DELAY`','Minutes before apply (not on real-time apply)'],
['`ALTERNATE`','Fallback destination']]},
{h:'Broker properties (DGMGRL)'},
{t:[['Property','Meaning'],
['`LogXptMode`','`SYNC`, `ASYNC`, `FASTSYNC`'],
['`RedoRoutes`','Who ships to whom (cascading, far sync)'],
['`DelayMins`','Apply delay'],
['`ApplyLagThreshold`, `TransportLagThreshold`','Alert thresholds in seconds'],
['`FastStartFailoverTarget`, `FastStartFailoverThreshold`','FSFO target and wait time'],
['`FastStartFailoverLagLimit`','Maximum lag for automatic failover (Max Performance)'],
['`StaticConnectIdentifier`','Static service for restart by broker'],
['`DGConnectIdentifier`','Connect string between sites'],
['`StandbyFileManagement`, `ArchiveLagTarget`','Broker managed parameters']]}
]},

/* 5 ---------------------------------------------------------------- views */
{t:'System views',d:'Which view answers which Data Guard question.',see:[[3,5,'Verifying with views'],[10,0,'Monitoring lag']],b:[
{t:[['Question','View'],
['Database role and mode','`V$DATABASE` (`DATABASE_ROLE`, `PROTECTION_MODE`, `PROTECTION_LEVEL`, `SWITCHOVER_STATUS`)'],
['Is there a transport or apply lag?','`V$DATAGUARD_STATS` (`transport lag`, `apply lag`)'],
['What are the processes doing?','`V$DATAGUARD_PROCESS`, `V$MANAGED_STANDBY`'],
['Destination state','`V$ARCHIVE_DEST`, `V$ARCHIVE_DEST_STATUS`'],
['Gaps','`V$ARCHIVE_GAP`'],
['Received and applied logs','`V$ARCHIVED_LOG` (`APPLIED`, `STANDBY_DEST`)'],
['Standby redo logs','`V$STANDBY_LOG`'],
['Apply rate','`V$RECOVERY_PROGRESS`'],
['Broker state','`V$DATAGUARD_CONFIG`, DGMGRL `SHOW CONFIGURATION`'],
['Recent messages','`V$DATAGUARD_STATUS`'],
['Standby open mode','`V$DATABASE.OPEN_MODE`'],
['FSFO status','`V$DATABASE` (`FS_FAILOVER_STATUS`, `FS_FAILOVER_CURRENT_TARGET`)'],
['Logical standby apply','`DBA_LOGSTDBY_EVENTS`, `V$LOGSTDBY_STATS`'],
['Flashback and restore points','`V$FLASHBACK_DATABASE_LOG`, `V$RESTORE_POINT`']]},
{code:`SELECT name, value, unit, time_computed FROM v$dataguard_stats
WHERE name IN ('transport lag','apply lag','apply finish time','estimated startup time');`}
]},

/* 6 ---------------------------------------------------------------- tools */
{t:'DGMGRL and other tools',d:'The broker commands you use daily, and the tools around them.',see:[[4,3,'DGMGRL commands'],[4,1,'Creating a broker configuration']],b:[
{t:[['Task','Command'],
['Connect','`dgmgrl sys@prim`'],
['Show configuration','`SHOW CONFIGURATION;`, `SHOW CONFIGURATION VERBOSE;`'],
['Show a database','`SHOW DATABASE stby;`, `SHOW DATABASE VERBOSE stby;`'],
['Check readiness','`VALIDATE DATABASE stby;`, `VALIDATE DATABASE VERBOSE stby;`'],
['Validate static connect','`VALIDATE STATIC CONNECT IDENTIFIER FOR stby;`'],
['Create configuration','`CREATE CONFIGURATION cfg AS PRIMARY DATABASE IS prim CONNECT IDENTIFIER IS prim;`'],
['Add a standby','`ADD DATABASE stby AS CONNECT IDENTIFIER IS stby MAINTAINED AS PHYSICAL;`'],
['Enable or disable','`ENABLE CONFIGURATION;`, `DISABLE DATABASE stby;`'],
['Change a property','`EDIT DATABASE stby SET PROPERTY LogXptMode = \'SYNC\';`'],
['Change protection mode','`EDIT CONFIGURATION SET PROTECTION MODE AS MaxAvailability;`'],
['Switchover','`SWITCHOVER TO stby;`'],
['Failover','`FAILOVER TO stby;`'],
['Reinstate','`REINSTATE DATABASE prim;`'],
['Convert standby','`CONVERT DATABASE stby TO SNAPSHOT STANDBY;`'],
['Start apply','`EDIT DATABASE stby SET STATE = \'APPLY-ON\';`'],
['FSFO','`ENABLE FAST_START FAILOVER;`, `START OBSERVER;`, `SHOW FAST_START FAILOVER;`']]},
{h:'Other tools'},
{t:[['Tool','Use'],
['`rman`','`DUPLICATE ... FOR STANDBY FROM ACTIVE DATABASE`, backups on a standby'],
['`sqlplus`','`ALTER DATABASE RECOVER MANAGED STANDBY DATABASE ...` (manual mode)'],
['`tnsping`, `lsnrctl`','Connectivity and static listener checks'],
['`orapwd`','Recreate a matching password file']]}
]},

/* 7 ---------------------------------------------------------------- decisions */
{t:'Decision tables',d:'Protection mode, transport, role change and standby type.',see:[[1,4,'Protection modes'],[5,0,'Switchover']],b:[
{h:'Protection modes'},
{t:[['Mode','Transport','Data loss','Primary stops if standby unreachable?'],
['Maximum Protection','`SYNC AFFIRM`','Zero','**Yes**'],
['Maximum Availability','`SYNC` (or `FASTSYNC`)','Zero when synchronized','No, drops to degraded'],
['Maximum Performance','`ASYNC`','Possible (seconds)','No']]},
{h:'Switchover or failover?'},
{t:[['Situation','Use'],
['Planned maintenance, DR test','Switchover'],
['Primary is gone and unrecoverable','Failover'],
['Failed primary can be fixed later','Failover, then reinstate with Flashback Database'],
['Automatic response needed','Fast-Start Failover with an observer']]},
{h:'Standby type'},
{t:[['Type','Use'],
['Physical (redo apply)','Default DR, identical blocks'],
['Active Data Guard (physical, open read only)','Reporting and backups on standby (licensed)'],
['Snapshot standby','Temporary read write testing'],
['Logical standby','Different structure, rolling upgrades (limited data types)'],
['Far sync','Zero data loss to a remote standby via a nearby relay']]},
{h:'Apply modes'},
{t:[['Mode','Meaning'],
['Real-time apply','Apply as redo arrives in standby redo logs (default with SRLs)'],
['Archived log apply','Apply only after the log is archived'],
['Delayed apply','Intentional delay to catch human errors']]}
]},

/* 8 ---------------------------------------------------------------- troubleshooting */
{t:'Troubleshooting lookup',d:'Symptom, what to check first, likely cause and fix.',see:[[10,3,'Standby out of sync'],[10,7,'Five broken standbys']],b:[
{t:[['Symptom','Check first','Likely cause','Fix'],
['Transport lag grows','`V$DATAGUARD_STATS`, `V$ARCHIVE_DEST_STATUS`, network','Network bandwidth or latency, standby I/O','Check path, SRLs, compression, `NET_TIMEOUT`'],
['Apply lag grows, transport fine','`V$RECOVERY_PROGRESS`, `V$MANAGED_STANDBY`','Slow apply, I/O, parallelism','Tune recovery parallelism, storage'],
['Gap does not close','`V$ARCHIVE_GAP`, `FAL_SERVER`','FAL not set or log removed','Fix FAL, restore the log, recreate standby if needed'],
['ORA-16191 or `PRIMARY_LOG_SHIPPING_CLIENT_NOT_LOGGED_ON`','Password files','Passwords differ','Copy the password file'],
['MRP stopped','Standby alert, `V$MANAGED_STANDBY`','Error such as missing file','Fix and restart `RECOVER MANAGED STANDBY DATABASE`'],
['Broker shows ERROR or WARNING','`SHOW DATABASE VERBOSE`','Property or state mismatch','Follow the ORA-16xxx text'],
['Switchover refused','`V$DATABASE.SWITCHOVER_STATUS`','Not synchronized, sessions, jobs','Resolve status, then retry'],
['Failed primary will not reinstate','Flashback on?','Flashback off or logs gone','Rebuild from the new primary'],
['FSFO not triggering','Observer, thresholds, `VALIDATE FAST_START FAILOVER`','Observer lost, lag over limit','Fix observer or thresholds'],
['Standby will not open read only','Alert log, `OPEN_MODE`','Needs ADG licence, apply running','Stop apply or enable ADG'],
['After adding datafile standby errors','`STANDBY_FILE_MANAGEMENT`','`MANUAL` and file missing','Set `AUTO`, create file']]}
]},

/* 9 ---------------------------------------------------------------- errors */
{t:'Common error messages',d:'The ORA-16xxx series and friends, with meaning and fix.',see:[[10,2,'Common errors'],[5,0,'Role transitions']],b:[
{t:[['Error','Meaning','Fix'],
['ORA-16009','Invalid redo transport destination','Check the destination parameters'],
['ORA-16014','Log not archived: no available destinations','Check destinations and space'],
['ORA-16038 / 16055','Log cannot be archived / FAL request rejected','Check destination errors'],
['ORA-16057','Server not in the Data Guard configuration','Fix `log_archive_config` and `db_unique_name`'],
['ORA-16191','Primary log shipping client not logged on standby','Sync password files'],
['ORA-16198','Timeout on internal channel','Check network, `NET_TIMEOUT`'],
['ORA-16139','Media recovery required','Run recovery or `ALTER DATABASE RECOVER ...`'],
['ORA-16661','Standby database needs to be reinstated','`REINSTATE DATABASE`'],
['ORA-16664','Unable to receive the result from a database','Check connectivity and broker'],
['ORA-16766 / 16747','Redo Apply is stopped / logical standby apply is stopped','Start apply'],
['ORA-16783','Instance not available for management','Check instance, static listener'],
['ORA-16789','Standby redo logs configured incorrectly','Fix SRL count and size'],
['ORA-16809','Multiple warnings detected for the database','`SHOW DATABASE VERBOSE`'],
['ORA-16810','Multiple errors or warnings for the database','Same'],
['ORA-16825','Multiple errors or warnings, including FSFO-related','Check FSFO and observer'],
['ORA-16853','Apply lag exceeded the threshold','Check apply'],
['ORA-16855','Transport lag exceeded the threshold','Check network'],
['ORA-16857','Standby disconnected from redo source too long','Check transport'],
['ORA-01033 / 01034','Not available or initialization in progress','Start or open the database'],
['ORA-00308 / 00279 / 00289','Cannot open archived log / change required / suggestion','Provide the named log'],
['ORA-01669','Standby control file not consistent with datafiles','Refresh control file or rebuild']]},
{note:'Always run `SHOW DATABASE VERBOSE <db>` after an ORA-168xx message. The broker lists what it found.'}
]},

/* 10 ---------------------------------------------------------------- health check */
{t:'Health-check SQL pack',d:'Paste-ready checks for the primary and the standby.',see:[[10,0,'Monitoring lag'],[11,2,'Switchover drills']],b:[
{h:'Role and mode (both sites)'},
{code:`SELECT name, db_unique_name, database_role, open_mode, protection_mode, protection_level, switchover_status
FROM v$database;`},
{h:'Lag (standby)'},
{code:`SELECT name, value, time_computed FROM v$dataguard_stats WHERE name IN ('transport lag','apply lag');
SELECT process, status, thread#, sequence#, block# FROM v$managed_standby ORDER BY process;
SELECT * FROM v$archive_gap;`},
{h:'Destinations (primary)'},
{code:`SELECT dest_id, dest_name, status, error, archived_seq#, applied_seq#, gap_status
FROM v$archive_dest_status WHERE status <> 'INACTIVE';
SELECT dest_id, db_unique_name, destination, status, error FROM v$archive_dest WHERE status <> 'INACTIVE';`},
{h:'Last sequence generated, received and applied'},
{code:`SELECT thread#, MAX(sequence#) last_seq FROM v$archived_log GROUP BY thread#;
SELECT thread#, MAX(sequence#) applied FROM v$archived_log WHERE applied = 'YES' GROUP BY thread#;`},
{h:'Broker'},
{code:`DGMGRL> SHOW CONFIGURATION;
DGMGRL> VALIDATE DATABASE VERBOSE stby;
DGMGRL> SHOW FAST_START FAILOVER;`}
]},

/* 11 ---------------------------------------------------------------- operations */
{t:'Role transition sequences',d:'Short, ordered sequences for switchover, failover and reinstate with the broker, and checks before each.',see:[[5,0,'Switchover'],[5,1,'Failover'],[5,2,'Reinstate']],b:[
{h:'Switchover'},
{code:`DGMGRL> VALIDATE DATABASE stby;
DGMGRL> SWITCHOVER TO stby;
DGMGRL> SHOW CONFIGURATION;`},
{flow:['Validate: ready for switchover = YES, no gaps','Check applications and jobs, drain services','Run SWITCHOVER','Check services start on the new primary','Verify standby (old primary) applies redo']},
{h:'Failover'},
{code:`DGMGRL> FAILOVER TO stby;
-- if the old primary comes back, reinstate it
DGMGRL> REINSTATE DATABASE prim;`},
{h:'Reinstate needs'},
{t:[['Requirement','Why'],
['Flashback Database was on on the failed primary','To rewind it to the failover SCN'],
['Flashback logs still available','Retention covers the divergence'],
['Network between sites','To fetch redo from the new primary'],
['Static listener or reachable instance','Broker must restart it']]},
{h:'Manual (without the broker)'},
{code:`-- on the primary
ALTER DATABASE COMMIT TO SWITCHOVER TO PHYSICAL STANDBY WITH SESSION SHUTDOWN;
-- on the standby
ALTER DATABASE COMMIT TO SWITCHOVER TO PRIMARY WITH SESSION SHUTDOWN;
ALTER DATABASE OPEN;`}
]},

/* 12 ---------------------------------------------------------------- naming / licensing */
{t:'Terms and licensing decoder',d:'Names of states and roles, and which features need Active Data Guard.',see:[[0,5,'Licensing'],[0,3,'Standby types']],b:[
{h:'Broker states'},
{t:[['Term','Meaning'],
['`TRANSPORT-ON` / `TRANSPORT-OFF`','Shipping enabled or paused'],
['`APPLY-ON` / `APPLY-OFF`','Redo Apply running or stopped'],
['`PHYSICAL STANDBY`, `LOGICAL STANDBY`, `SNAPSHOT STANDBY`, `FAR SYNC`','Database roles'],
['`SUCCESS`, `WARNING`, `ERROR`','Broker status of the configuration or database'],
['`SYNCHRONIZED`, `NOT SYNCHRONIZED`','Zero lag in SYNC modes'],
['`TO PRIMARY`, `TO STANDBY`, `SESSIONS ACTIVE`','`SWITCHOVER_STATUS` values']]},
{h:'Data Guard or Active Data Guard?'},
{t:[['Feature','Data Guard','Active Data Guard'],
['Redo transport and apply, switchover, failover, broker','Yes','Yes'],
['Open read only while applying (real-time query)','No','Yes'],
['Automatic block repair','No','Yes'],
['Offload backups to standby (incremental with change tracking)','No','Yes'],
['Far sync (zero data loss over distance)','No','Yes'],
['DML redirection','No','Yes'],
['Snapshot standby','Yes','Yes'],
['Rolling upgrade with `DBMS_ROLLING`','Yes','Yes']]},
{note:'Licensing rules change with releases. Confirm in the Licensing Information User Manual.'}
]}

]};
