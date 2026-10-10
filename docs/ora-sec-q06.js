/* LearnSphere - Security quiz, Section 06: Auditing & Activity Monitoring.
   window.QUIZZES['ora-sec:5']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:5']={qs:[
{q:'What is the **unified audit trail** view?',o:['UNIFIED_AUDIT_TRAIL','DBA_AUDIT_TRAIL','V$AUDIT','AUD$ only'],a:0,why:'One place for all.',lec:0},
{q:'Which roles manage and read unified audit?',o:['AUDIT_ADMIN and AUDIT_VIEWER','DBA only','SYSDBA only','PUBLIC'],a:0,why:'Separation of duties.',lec:0},
{q:'What is **mixed mode**?',o:['Traditional and unified both active','Only unified','Only traditional','No audit'],a:0,why:'Default after upgrade.',lec:0},
{q:'How do you make **pure unified** mode?',o:['Relink the binaries (uniaud_on)','Set a parameter','Restart listener','Nothing'],a:0,why:'Requires relink.',lec:0},
{q:'Which statement **enables** a policy?',o:['AUDIT POLICY name','CREATE AUDIT','ENABLE POLICY','SET AUDIT'],a:0,why:'Optionally BY users.',lec:1},
{q:'What does **EXCEPT** do?',o:['Excludes users from the audit','Includes only users','Deletes the policy','Disables audit'],a:0,why:'For example app_batch.',lec:1},
{q:'What should you audit?',o:['What you will review','Everything','Nothing','Only SELECT'],a:0,why:'Volume hides the events that matter.',lec:1},
{q:'Which are good **targets** for audit?',o:['Logon failures','Use of powerful privileges','Changes to users and roles','Every SELECT'],a:[0,1,2],why:'Targeted.',lec:1},
{q:'Which column shows **success or failure**?',o:['RETURN_CODE','ACTION_NAME','OBJECT_NAME','USERHOST'],a:0,why:'0 success.',lec:2},
{q:'Why forward the trail to a **SIEM**?',o:['A privileged user cannot erase their trail','It is faster','It is required','It saves space'],a:0,why:'Integrity.',lec:2},
{q:'Which column shows the **policy** that caused a record?',o:['UNIFIED_AUDIT_POLICIES','DBUSERNAME','SQL_TEXT','OS_USERNAME'],a:0,why:'Helps tuning.',lec:2},
{q:'Which package manages **purge**?',o:['DBMS_AUDIT_MGMT','DBMS_FGA','DBMS_STATS','DBMS_LOCK'],a:0,why:'CLEAN_AUDIT_TRAIL.',lec:3},
{q:'What must happen **before** purging?',o:['Archive or export confirmed','Restart','A backup of SYSTEM','Nothing'],a:0,why:'Compliance retention.',lec:3},
{q:'Where should the trail be?',o:['A dedicated tablespace','SYSTEM','TEMP','UNDO'],a:0,why:'Control growth.',lec:3},
{q:'What does **FGA** audit?',o:['Specific columns under a condition','Everything','Only logons','Only DDL'],a:0,why:'Targeted.',lec:4},
{q:'What can FGA do that policies cannot?',o:['Run a handler','Audit logons','Audit DDL','Audit roles'],a:0,why:'For example an alert.',lec:4},
{q:'Which package manages **FGA**?',o:['DBMS_FGA','DBMS_AUDIT_MGMT','DBMS_RLS','DBMS_SESSION'],a:0,why:'ADD_POLICY.',lec:4},
{q:'A **common policy** is created in:',o:['The root','A PDB','The OS','The listener'],a:0,why:'Applies to PDBs.',lec:5},
{q:'Which view gives audit records **across containers**?',o:['CDB_UNIFIED_AUDIT_TRAIL','V$LOG','V$LOCK','DBA_USERS'],a:0,why:'From the root.',lec:5},
{q:'A PDB administrator sees:',o:['Only that PDB records','All PDBs','Root only','Nothing'],a:0,why:'Scope.',lec:5},
{q:'In the practical, how many events do you expect?',o:['Three, for the three statements','None','One','Hundreds'],a:0,why:'Create, grant, drop.',lec:6},
{q:'Who should be able to **disable** audit policies?',o:['Only AUDIT_ADMIN','Anyone','Every DBA','PUBLIC'],a:0,why:'Protect settings.',lec:6},
{q:'Is a purge **job** needed?',o:['Yes, with justified retention','No','Only monthly manually','Never'],a:0,why:'Trail growth.',lec:6},
{q:'Which clause makes a policy **conditional**?',o:['WHEN ... EVALUATE','ONLY','IF','CASE'],a:0,why:'Per session or statement.',lec:1},
{q:'Which are included in the **policy** parts?',o:['PRIVILEGES','ACTIONS','ROLES','TABLESPACES'],a:[0,1,2],why:'Not tablespaces.',lec:1}
]};
