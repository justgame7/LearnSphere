/* LearnSphere - SQL Server Backup, Restore & Recovery, Section 06: Corruption & Repair.
   Lectures 0-4 are core, 5 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const cause=M.dg(700,200,[
[10,15,680,170,'Where corruption comes from',1],
[30,50,150,55,'Storage|disk, controller,|firmware',2],[200,50,150,55,'Memory|bad RAM, driver|bug',2],[370,50,150,55,'Software|antivirus,|filter drivers',0],[540,50,130,55,'SQL Server|rare engine bug',0],
[30,120,640,50,'SQL Server detects it with PAGE_VERIFY CHECKSUM when a page is read, and CHECKDB finds it before users do',0]],
[]);

const chk=M.dg(700,170,[
[10,20,200,60,'DBCC CHECKDB',2],[250,20,200,60,'Allocation errors|consistency errors',0],[490,20,200,60,'Minimum repair level|REPAIR_REBUILD or|REPAIR_ALLOW_DATA_LOSS',0],
[10,100,680,55,'Read the last line first: "CHECKDB found n allocation errors and n consistency errors in database ..."',0]],
[[210,50,250,50],[450,50,490,50]]);

const sus=M.dg(700,150,[
[10,25,200,70,'Engine reads a page|error 823, 824 or|bad checksum',0],[250,25,200,70,'msdb.dbo.suspect_pages|database, file, page,|event type',2],[490,25,200,70,'Alert, then CHECKDB|and restore plan',0]],
[[210,60,250,60],[450,60,490,60]]);

const rep=M.dg(700,200,[
[10,15,215,170,'REPAIR_REBUILD',1],[25,50,185,35,'No data loss',2],[25,95,185,35,'Rebuilds indexes',0],[25,140,185,35,'Rarely enough',0],
[245,15,215,170,'REPAIR_ALLOW_DATA_LOSS',1],[260,50,185,35,'Can delete rows',2],[260,95,185,35,'Breaks constraints',0],[260,140,185,35,'Last resort',2],
[480,15,210,170,'Better first',1],[495,50,180,35,'Restore from backup',2],[495,95,180,35,'Page restore',0],[495,140,180,35,'Rebuild an index',0]],
[]);

const dec=M.dg(700,220,[
[10,10,200,50,'Corruption found',2],
[10,90,200,50,'Only a nonclustered|index?',0],[250,90,200,50,'Few pages, FULL|recovery?',0],[490,90,200,50,'Widespread or|unknown?',0],
[10,170,200,40,'Drop and recreate index',0],[250,170,200,40,'Page restore',2],[490,170,200,40,'Restore database, then|find root cause',2]],
[[110,60,110,90],[110,60,350,90],[110,60,590,90],[110,140,110,170],[350,140,350,170],[590,140,590,170]]);

/* ---------- 0: Types and causes ---------- */
L['mss-bkp:5:0']={blocks:[
{p:'**Corruption** means that data on disk is not what SQL Server wrote. It is rare, but when it happens it is usually caused **below** SQL Server, in storage or memory.'},
{svg:cause},
{h:'Kinds you will meet'},
{t:[['Kind','Example symptom'],
['**Torn or bad page**','Error 824, checksum mismatch'],
['**I/O error**','Error 823 from the OS'],
['**Allocation error**','CHECKDB reports allocation inconsistencies'],
['**Logical inconsistency**','Index does not match the table'],
['**Metadata corruption**','System tables inconsistent']]},
{h:'Settings that help you find it'},
{ul:['`PAGE_VERIFY = CHECKSUM` on every database.','`BACKUP ... WITH CHECKSUM` for every backup.','**Alerts** for errors 823, 824 and 825 and severity 19 to 25.','**Regular CHECKDB**, as Section 9 of Core DBA explains.']},
{code:`SELECT name, page_verify_option_desc FROM sys.databases;`},
{note:'When corruption appears, treat it as a **storage or hardware incident** first. Repairing the database without fixing the cause invites a repeat.'}],
src:[['Understand and resolve database corruption','https://learn.microsoft.com/en-us/troubleshoot/sql/database-engine/database-file-operations/troubleshoot-database-consistency-errors-reported-by-dbcc-checkdb'],['MSSQLSERVER_824',M.RD+'errors-events/mssqlserver-824-database-engine-error']]};

/* ---------- 1: CHECKDB output ---------- */
L['mss-bkp:5:1']={blocks:[
{p:'Most of the skill in handling corruption is **reading the CHECKDB output correctly**. It tells you how bad the problem is and what repair, if any, is possible.'},
{svg:chk},
{code:`DBCC CHECKDB (SalesDB) WITH NO_INFOMSGS, ALL_ERRORMSGS;`},
{h:'Important options'},
{t:[['Option','Effect'],
['`NO_INFOMSGS`','Hide informational lines'],
['`ALL_ERRORMSGS`','Show every error, not only the first 200'],
['`PHYSICAL_ONLY`','Faster, page-level checks only'],
['`DATA_PURITY`','Check column values (on by default for new databases)'],
['`EXTENDED_LOGICAL_CHECKS`','Deeper index checks, slower'],
['`ESTIMATEONLY`','Show tempdb space needed'],
['`TABLOCK`','Use locks instead of a snapshot']]},
{h:'How to read it'},
{ul:['The **last line** gives the totals and the **minimum repair level** needed.','Messages name **object, index, partition and page** (for example `1:57`).','Errors in a **nonclustered index** are fixed by recreating the index.','Errors in the **clustered index or heap** mean real data is damaged.','Do not repair yet. First save the output to a file and make a backup.']},
{note:'CHECKDB uses an internal snapshot, so it needs space in the database volume. On busy servers use PHYSICAL_ONLY regularly and a full check on a restored copy.'}],
src:[['DBCC CHECKDB',M.TS+'database-console-commands/dbcc-checkdb-transact-sql'],['CHECKDB errors',M.SQL+'relational-databases/errors-events/mssqlserver-8914-database-engine-error']]};

/* ---------- 2: Suspect pages ---------- */
L['mss-bkp:5:2']={blocks:[
{p:'SQL Server logs pages that fail checks in **msdb.dbo.suspect_pages**. It is a quick list of what has been seen, and it is the right place to start when an alert fires.'},
{svg:sus},
{t:[['event_type','Meaning'],
['1','823 error or bad page with an operating system error'],
['2','Bad checksum'],
['3','Torn page'],
['4','Restored: page was restored from backup'],
['5','Repaired: page was repaired by DBCC'],
['7','Deallocated by DBCC']]},
{code:`SELECT DB_NAME(database_id) AS db, file_id, page_id, event_type, error_count, last_update_date
FROM   msdb.dbo.suspect_pages
ORDER  BY last_update_date DESC;

-- Look at the page header (undocumented, for diagnosis only)
DBCC TRACEON (3604);
DBCC PAGE ('SalesDB', 1, 57, 0);`},
{h:'Housekeeping'},
{ul:['The table holds at most **1,000 rows**. Clear restored or repaired rows after resolution.','Pages marked event 4, 5 or 7 are resolved. Do not delete unresolved rows.','Availability groups record **automatic page repair** in `sys.dm_hadr_auto_page_repair`.']},
{note:'Set up alerts for errors 823, 824 and 825, so you see problems when they happen and not at the next weekly check.'}],
src:[['Manage the suspect_pages table',M.RD+'backup-restore/manage-the-suspect-pages-table-sql-server'],['sys.dm_hadr_auto_page_repair',M.RD+'system-dynamic-management-views/sys-dm-hadr-auto-page-repair-transact-sql']]};

/* ---------- 3: Repair options ---------- */
L['mss-bkp:5:3']={blocks:[
{p:'**DBCC CHECKDB** can repair some damage. The repair options are powerful and risky, so know exactly what each does before you consider using one.'},
{svg:rep},
{t:[['Option','What it does','Risk'],
['`REPAIR_REBUILD`','Fixes without data loss: rebuilds nonclustered indexes, repairs minor issues','Low, but often not enough'],
['`REPAIR_ALLOW_DATA_LOSS`','Deallocates damaged pages and fixes structures','Deletes data, may break foreign keys and business rules']]},
{h:'If you must run a repair'},
{flow:['Take a backup of the damaged database (CONTINUE_AFTER_ERROR if needed)','Restore a copy somewhere safe and try the repair there first','Put the database in SINGLE_USER mode','Run DBCC CHECKDB with the repair option','Run DBCC CHECKCONSTRAINTS and check application data','Take a new full backup and start a new log chain']},
{code:`ALTER DATABASE SalesDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
DBCC CHECKDB (SalesDB, REPAIR_ALLOW_DATA_LOSS);
ALTER DATABASE SalesDB SET MULTI_USER;
DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS;`},
{note:'Repair makes the database consistent, not correct. Rows can be silently gone. Business owners must accept that before repair is used on production.'}],
src:[['DBCC CHECKDB repair options',M.TS+'database-console-commands/dbcc-checkdb-transact-sql'],['DBCC CHECKCONSTRAINTS',M.TS+'database-console-commands/dbcc-checkconstraints-transact-sql']]};

/* ---------- 4: Recover from backups ---------- */
L['mss-bkp:5:4']={blocks:[
{p:'The best repair is a **restore**. Which kind depends on how much is damaged and what backups you have.'},
{svg:dec},
{h:'Work out when it started'},
{p:'Corruption may be **older** than your latest backup. Restore a few older full backups to test servers and run CHECKDB on them, to find the last clean point and see how long the problem has existed.'},
{h:'Routes'},
{t:[['Situation','Action'],
['Only a nonclustered index','`ALTER INDEX ... REBUILD`, or drop and create'],
['A few data pages, FULL recovery, logs intact','Page restore'],
['Widespread damage','Restore the database (full, diff, logs) to new storage'],
['No clean backup','Restore the best copy, extract data with queries, accept loss, use repair last'],
['Availability group present','Check automatic page repair and the healthy replica']]},
{code:`-- Rebuild a damaged nonclustered index
ALTER INDEX IX_Orders_Customer ON sales.Orders REBUILD;

-- Prove the restored copy is clean
DBCC CHECKDB (SalesDB_Restored) WITH NO_INFOMSGS, ALL_ERRORMSGS;`},
{h:'After recovery'},
{ul:['Find and fix the **root cause**: storage, firmware, memory, drivers.','Run **CHECKDB on all databases** on the same server.','Record what happened and update the **runbook** and monitoring.']}],
src:[['Restore a database backup',M.RD+'backup-restore/restore-a-database-backup-using-ssms'],['Restore pages',M.RD+'backup-restore/restore-pages-sql-server']]};

})();
