/* LearnSphere - SQL Server Core DBA, Section 09: Maintenance.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const frag=M.dg(700,170,[
[10,25,190,70,'Under 5 percent|do nothing',0],[255,25,190,70,'5 to 30 percent|REORGANIZE|online, light',2],[500,25,190,70,'Over 30 percent|REBUILD|new copy, updates stats',2],
[10,115,680,38,'Only for indexes of 1,000 pages or more. Small indexes: ignore fragmentation.',0]],
[[200,60,255,60],[445,60,500,60]]);

const stats=M.dg(700,160,[
[10,25,180,70,'Statistics|histogram of values',0],[230,25,220,70,'Optimizer|estimates rows',2],[490,25,200,70,'Plan quality|good or bad',0],
[10,115,680,36,'Stale statistics are a top cause of slow queries',0]],
[[190,60,230,60],[450,60,490,60]]);

const chk=M.dg(700,150,[
[10,25,180,70,'DBCC CHECKDB|weekly or more',2],[230,25,220,70,'No errors|log the result',0],[490,25,200,70,'Errors|restore from backup,|repair last',2]],
[[190,50,230,50],[190,70,490,70]]);

const plan=M.dg(700,190,[
[10,15,210,160,'Maintenance plan',1],[30,50,170,30,'Wizard, GUI',0],[30,90,170,30,'Fixed options',0],[30,130,170,30,'Limited logic',0],
[250,15,210,160,'Own scripts',1],[270,50,170,30,'Full control',0],[270,90,170,30,'Needs skill',0],[270,130,170,30,'You must support them',0],
[490,15,200,160,'Community solution',1],[505,50,170,30,'Tested, flexible',0],[505,90,170,30,'Logging, thresholds',2],[505,130,170,30,'Widely used',0]],
[]);

/* ---------- 0: Index maintenance ---------- */
L['mss-core:8:0']={blocks:[
{p:'Indexes get **fragmented** as rows are inserted, updated and deleted. Maintenance reorders pages and removes wasted space. It matters, but it is often over-done, so do it by threshold.'},
{svg:frag},
{h:'Two operations'},
{t:[['','REORGANIZE','REBUILD'],
['**What**','Reorders leaf pages in place','Creates a new copy of the index'],
['**Online**','Always','Offline, or ONLINE = ON in Enterprise'],
['**Updates statistics**','No','Yes (full scan for that index)'],
['**Log and resources**','Small, interruptible','More, can be resumable (2017+, Enterprise)'],
['**Use when**','5 to 30 percent fragmentation','Over 30 percent or to change settings']]},
{h:'Find fragmented indexes'},
{code:`SELECT OBJECT_NAME(ips.object_id) AS table_name, i.name AS index_name,
       ips.avg_fragmentation_in_percent, ips.page_count
FROM   sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN   sys.indexes i ON i.object_id = ips.object_id AND i.index_id = ips.index_id
WHERE  ips.page_count >= 1000 AND ips.avg_fragmentation_in_percent > 5
ORDER  BY ips.avg_fragmentation_in_percent DESC;`},
{code:`ALTER INDEX IX_Orders_Customer ON sales.Orders REORGANIZE;

ALTER INDEX IX_Orders_Customer ON sales.Orders
  REBUILD WITH (ONLINE = ON, MAXDOP = 4, SORT_IN_TEMPDB = ON);`},
{note:'On modern flash storage, logical fragmentation often matters little. Keeping statistics fresh usually helps more. Measure before spending a maintenance window on rebuilds.'}],
src:[['Reorganize and rebuild indexes',M.RD+'indexes/reorganize-and-rebuild-indexes'],['sys.dm_db_index_physical_stats',M.RD+'system-dynamic-management-views/sys-dm-db-index-physical-stats-transact-sql']]};

/* ---------- 1: Statistics ---------- */
L['mss-core:8:1']={blocks:[
{p:'**Statistics** describe the distribution of values in a column or index. The optimizer uses them to estimate row counts. If they are wrong, plans are wrong.'},
{svg:stats},
{h:'How they stay current'},
{ul:['**AUTO_UPDATE_STATISTICS** ON: SQL Server refreshes statistics when enough rows have changed. With compatibility level 130 and higher, the threshold is lower for large tables.','**AUTO_UPDATE_STATISTICS_ASYNC**: queries do not wait for the update.','A **rebuild** of an index updates its statistics with a full scan, a reorganize does not.']},
{h:'Check them'},
{code:`SELECT OBJECT_NAME(s.object_id) AS table_name, s.name AS stat_name,
       sp.last_updated, sp.rows, sp.rows_sampled, sp.modification_counter
FROM   sys.stats s
CROSS  APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE  OBJECTPROPERTY(s.object_id, 'IsUserTable') = 1
ORDER  BY sp.modification_counter DESC;`},
{h:'Update them'},
{code:`-- One table, full scan
UPDATE STATISTICS sales.Orders WITH FULLSCAN;

-- One statistic with a sample
UPDATE STATISTICS sales.Orders IX_Orders_Customer WITH SAMPLE 25 PERCENT;

-- All stale statistics in the database (quick, default sample)
EXEC sp_updatestats;`},
{note:'A common routine is a nightly or weekly update of statistics on tables with many changes, instead of relying only on automatic updates. Large tables with skewed data may need a full scan.'}],
src:[['Statistics',M.RD+'statistics/statistics'],['sys.dm_db_stats_properties',M.RD+'system-dynamic-management-views/sys-dm-db-stats-properties-transact-sql']]};

/* ---------- 2: CHECKDB ---------- */
L['mss-core:8:2']={blocks:[
{p:'**DBCC CHECKDB** verifies the **physical and logical integrity** of a database. Corruption you find early is a small problem. Corruption you find during a restore is a disaster.'},
{svg:chk},
{h:'Run it'},
{code:`-- Standard check, errors only
DBCC CHECKDB (SalesDB) WITH NO_INFOMSGS, ALL_ERRORMSGS;

-- Faster, physical checks only (page and checksum level)
DBCC CHECKDB (SalesDB) WITH NO_INFOMSGS, PHYSICAL_ONLY;`},
{h:'Planning'},
{ul:['Run it **at least weekly**, and always **after a restore**.','It reads the whole database, so schedule off-peak or run it on a restored copy.','Large databases: use PHYSICAL_ONLY more often and a full check on a copy.','Keep `PAGE_VERIFY = CHECKSUM` so corruption is detected on read.']},
{h:'When corruption is found'},
{flow:['Do not panic and do not run repair yet','Check the error log and hardware','Restore from the last good full, differential and log backups','Use REPAIR_ALLOW_DATA_LOSS only as the last resort, after a backup']},
{h:'Signs from the engine'},
{t:[['Error','Meaning'],
['**823**','I/O error from the OS or hardware'],
['**824**','Logical consistency error, bad page checksum'],
['**825**','Read retry succeeded: early warning of failing storage']]},
{code:`-- Pages SQL Server has flagged
SELECT * FROM msdb.dbo.suspect_pages;`},
{note:'REPAIR_ALLOW_DATA_LOSS can delete data to make the database consistent. It does not recover lost rows. Backups are the real fix.'}],
src:[['DBCC CHECKDB',M.TS+'database-console-commands/dbcc-checkdb-transact-sql'],['Manage suspect_pages',M.RD+'backup-restore/manage-the-suspect-pages-table-sql-server']]};

/* ---------- 3: Ola Hallengren ---------- */
L['mss-core:8:3']={blocks:[
{p:'The **Ola Hallengren Maintenance Solution** is a free, widely used set of T-SQL procedures for backups, integrity checks and index and statistics maintenance. Many production environments use it instead of building their own.'},
{h:'What you get'},
{t:[['Procedure','Purpose'],
['**DatabaseBackup**','Full, differential and log backups with options'],
['**DatabaseIntegrityCheck**','CHECKDB and related checks'],
['**IndexOptimize**','Reorganize or rebuild by threshold, plus statistics'],
['**CommandLog**','Table that logs every command run'],
['**Agent jobs**','Created by the install script, ready to schedule']]},
{h:'Install'},
{flow:['Download MaintenanceSolution.sql from the project site','Review it, set the backup directory in the script','Run it in a utility database (often master or a DBA database)','Check the jobs it created and schedule them']},
{h:'Example calls'},
{code:`EXECUTE dbo.DatabaseBackup
  @Databases = 'USER_DATABASES', @Directory = 'E:\\Backup',
  @BackupType = 'FULL', @Compress = 'Y', @Verify = 'Y', @CleanupTime = 168;

EXECUTE dbo.DatabaseIntegrityCheck
  @Databases = 'USER_DATABASES', @CheckCommands = 'CHECKDB';

EXECUTE dbo.IndexOptimize
  @Databases = 'USER_DATABASES',
  @FragmentationLow = NULL,
  @FragmentationMedium = 'INDEX_REORGANIZE,INDEX_REBUILD_ONLINE',
  @FragmentationHigh = 'INDEX_REBUILD_ONLINE,INDEX_REBUILD_OFFLINE',
  @FragmentationLevel1 = 5, @FragmentationLevel2 = 30,
  @UpdateStatistics = 'ALL', @OnlyModifiedStatistics = 'Y';`},
{note:'Read the documentation and review parameters before scheduling. Defaults are reasonable, but your retention, windows and thresholds are your own to set.'}],
src:[['SQL Server Maintenance Solution','https://ola.hallengren.com/'],['Index maintenance guidance',M.RD+'indexes/reorganize-and-rebuild-indexes']]};

/* ---------- 4: Maintenance plans vs scripts ---------- */
L['mss-core:8:4']={blocks:[
{p:'There are three common ways to run maintenance. The best one is the one your team can **support, monitor and explain**.'},
{svg:plan},
{h:'Comparison'},
{t:[['Option','Strengths','Weak points'],
['**Maintenance plans**','Fast to build, GUI, built in','Few options, no thresholds in basic tasks, hard to version'],
['**Your own scripts**','Exact fit for your needs','You build, test and fix everything'],
['**Community solution**','Mature, flexible, logs commands','Needs reading and tuning']]},
{h:'Whatever you choose, make sure'},
{ul:['**Backups** are verified and tested by restore.','**Integrity checks** run regularly and results are alerted on.','**Index and statistics** work is done by threshold, not blindly.','**Job failures** send an alert to a person.','**History cleanup** for msdb, job history and logs runs.']},
{h:'Check what is scheduled'},
{code:`SELECT j.name, j.enabled, s.name AS schedule_name, s.freq_type, s.active_start_time
FROM   msdb.dbo.sysjobs j
LEFT   JOIN msdb.dbo.sysjobschedules js ON js.job_id = j.job_id
LEFT   JOIN msdb.dbo.sysschedules s ON s.schedule_id = js.schedule_id
ORDER  BY j.name;

-- Last outcome of each job
SELECT j.name, h.run_status, h.run_date, h.run_time
FROM   msdb.dbo.sysjobs j
JOIN   msdb.dbo.sysjobhistory h ON h.job_id = j.job_id AND h.step_id = 0
ORDER  BY h.run_date DESC, h.run_time DESC;`},
{note:'SQL Server Agent is not available in Express. Use the OS scheduler with sqlcmd or a script runner instead.'}],
src:[['Maintenance plans',M.RD+'maintenance-plans/maintenance-plans'],['SQL Server Agent','https://learn.microsoft.com/en-us/ssms/agent/sql-server-agent']]};

})();
