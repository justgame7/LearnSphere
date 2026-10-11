/* LearnSphere - SQL Server Upgrade, Patching & Migration quiz, Section 5: Cross-Platform & Heterogeneous Migration.
   Format: see pg-quiz.js. window.QUIZZES['mss-upg:4']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-upg:4']={qs:[
{q:'Can a **Windows backup be restored on Linux**?',
 o:['Yes, same or newer version','No','Only for system databases','Only with SSIS'],
 a:0,why:'The database format is the same on both platforms.',lec:0},
{q:'What is usually the **hardest part** of Windows to Linux migration?',
 o:['Authentication, paths, jobs and platform features','The data format','T-SQL syntax','Collations'],
 a:0,why:'The engine is the same. Environment details differ.',lec:0},
{q:'Where must **container data** live?',
 o:['In persistent volumes outside the container','Inside the container only','In tempdb','In the image'],
 a:0,why:'Container storage is ephemeral unless volumes are used.',lec:1},
{q:'Which is a **caution** for SQL Server in Kubernetes?',
 o:['HA, storage and backup need clear design','It cannot run','It has no T-SQL','It needs Windows'],
 a:0,why:'State and recovery need explicit design in orchestrated environments.',lec:1},
{q:'What does **SSMA** automate?',
 o:['Assessment, schema conversion and data migration','Backups','Patching','Replication'],
 a:0,why:'SSMA helps convert objects and move data, but manual review is still needed.',lec:2},
{q:'Which Oracle feature has **no direct** SQL Server equivalent?',
 o:['PL/SQL packages','Tables','Indexes','Views'],
 a:0,why:'SQL Server has no packages, so code is split into procedures and schemas.',lec:2},
{q:'What should always happen after automated conversion?',
 o:['Review, fix and test with real queries','Go to production','Delete the source','Skip tuning'],
 a:0,why:'Converted code needs review and performance work.',lec:2},
{q:'Which tool family covers **MySQL, Db2 and SAP ASE** sources?',
 o:['SSMA','DBCC','Profiler','Resource Governor'],
 a:0,why:'SSMA has versions for several source platforms.',lec:3},
{q:'What causes many **subtle bugs** in heterogeneous migrations?',
 o:['Data types, NULL and date handling, collation','Table names','Index count','Backup size'],
 a:0,why:'Semantic differences show up in edge cases.',lec:3}
]};
