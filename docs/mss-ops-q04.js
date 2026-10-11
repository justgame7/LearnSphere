/* LearnSphere - SQL Server Operations, Monitoring & Automation quiz, Section 4: Multi-Server Administration.
   Format: see pg-quiz.js. window.QUIZZES['mss-ops:3']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-ops:3']={qs:[
{q:'What does a **Central Management Server** store?',
 o:['Groups of registered servers','User data','Backups','tempdb'],
 a:0,why:'A CMS keeps server groups so you can run queries and policies across them.',lec:0},
{q:'What can you do with a **CMS group**?',
 o:['Run one query on all servers','Evaluate a policy on all servers','Register servers by environment','Replace backups'],
 a:[0,1,2],why:'CMS does not replace backups.',lec:0},
{q:'What is **MSX/TSX**?',
 o:['Master and target Agent administration','Two editions','A backup type','A replication type'],
 a:0,why:'A master server defines jobs for target servers.',lec:1},
{q:'What is a **con** of master and target jobs?',
 o:['The master is a dependency','Jobs cannot run','They need Express','They need a domain controller only'],
 a:0,why:'If the master is unavailable, status and updates stop.',lec:1},
{q:'In Policy-Based Management, what is a **facet**?',
 o:['A set of properties of a managed object','A server group','A job','A backup'],
 a:0,why:'Conditions are built from facet properties.',lec:2},
{q:'What does PBM mostly do for most checks?',
 o:['Report non-compliance','Fix it automatically always','Replace Agent','Encrypt data'],
 a:0,why:'Most evaluations report. Few support enforcement.',lec:2},
{q:'Why keep an **inventory**?',
 o:['Patching, licensing, security and capacity depend on it','To fill a spreadsheet','For marketing','It is required for backups'],
 a:0,why:'Without a list, nothing else can be managed consistently.',lec:3},
{q:'What makes a configuration **standard** useful?',
 o:['It is written down and checkable','It is only discussed','It is secret','It is optional'],
 a:0,why:'Checkable standards can be audited and enforced.',lec:3}
]};
