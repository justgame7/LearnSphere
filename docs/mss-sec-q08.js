/* LearnSphere - SQL Server Security & Compliance quiz, Section 8: Auditing.
   Format: see pg-quiz.js. window.QUIZZES['mss-sec:7']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-sec:7']={qs:[
{q:'Which object defines **where audit records are written**?',
 o:['Server audit','Audit specification','Login','Role'],
 a:0,why:'The server audit holds the target and failure behavior. Specifications define what to capture.',lec:0},
{q:'What does **ON_FAILURE = SHUTDOWN** do?',
 o:['Stops the instance if auditing fails','Ignores errors','Deletes old audit data','Disables logins'],
 a:0,why:'It is used when missing audit records are not acceptable.',lec:0},
{q:'Which action group records **failed logins**?',
 o:['FAILED_LOGIN_GROUP','LOGIN_GROUP','AUDIT_FAIL','LOGON_ERROR'],
 a:0,why:'FAILED_LOGIN_GROUP audits failed login attempts.',lec:1},
{q:'Which statement is **true** about database audit specifications?',
 o:['They can audit SELECT on a specific table','They run at server level only','They require Windows logs only','They cannot be filtered'],
 a:0,why:'Database specifications can track actions on specific objects and principals.',lec:1},
{q:'Why **forward** audit data to a central system?',
 o:['So local admins cannot erase the trail','To speed up backups','To reduce licensing','To compress data'],
 a:0,why:'A central copy keeps evidence outside the control of the audited people.',lec:2},
{q:'Which target is **fast and readable with T-SQL**?',
 o:['File','Windows Application log only','Printer','Email'],
 a:0,why:'.sqlaudit files can be read with sys.fn_get_audit_file.',lec:2},
{q:'Which function **reads audit files**?',
 o:['sys.fn_get_audit_file','sys.fn_dblog','sys.fn_trace_gettable only','sys.fn_my_permissions'],
 a:0,why:'sys.fn_get_audit_file returns events from .sqlaudit files.',lec:3},
{q:'Which events are good candidates for **alerts**?',
 o:['Many failed logins from one source','Privileged role membership changes','Audit stopped or failed','Every SELECT of every user'],
 a:[0,1,2],why:'Alert on high-signal events. Alerting on every read creates noise.',lec:3}
]};
