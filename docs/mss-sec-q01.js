/* LearnSphere - SQL Server Security & Compliance quiz, Section 1: Security Foundations.
   Format: see pg-quiz.js. window.QUIZZES['mss-sec:0']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-sec:0']={qs:[
{q:'What does **defense in depth** mean?',
 o:['Several layers of controls so one failure is not fatal','One very strong password','Only a firewall','Only encryption'],
 a:0,why:'Layers make sure an attacker who passes one control meets another.',lec:0},
{q:'Which layer do **developers** mostly own?',
 o:['Application: parameterized queries and secrets','Firewall rules','Hardware','Domain controllers'],
 a:0,why:'Safe queries and secret handling are application responsibilities.',lec:0},
{q:'Which is a typical **threat** to a SQL Server database?',
 o:['Over-privileged accounts','Short table names','Many indexes','Large log files'],
 a:0,why:'Excess permissions increase the damage of a stolen or misused account.',lec:1},
{q:'Which control helps against **stolen backup files**?',
 o:['Backup encryption or TDE','More indexes','Higher MAXDOP','Smaller log'],
 a:0,why:'Encryption makes a stolen file unreadable without the keys.',lec:1},
{q:'What is the difference between a **login** and a **user**?',
 o:['Login is the server-level identity, user is the database-level identity','They are the same','User is only for Linux','Login is only for Azure'],
 a:0,why:'A login connects to the instance and is mapped to a user in each database.',lec:2},
{q:'Which **principals** exist at the database level?',
 o:['Users','Database roles','Application roles','Server logins'],
 a:[0,1,2],why:'Logins are server-level principals.',lec:2},
{q:'What happens when a permission is both **GRANTed and DENYed**?',
 o:['The DENY wins','The GRANT wins','The newest wins','Neither applies'],
 a:0,why:'DENY overrides GRANT, except for sysadmin members who bypass checks.',lec:3},
{q:'Which function shows **your own effective permissions**?',
 o:['sys.fn_my_permissions','sys.fn_dblog','sys.fn_xe_file_target_read_file','sys.fn_listextendedproperty'],
 a:0,why:'sys.fn_my_permissions returns the permissions of the current principal on a securable.',lec:3},
{q:'Which permission means **everything** on a securable, including granting?',
 o:['CONTROL','SELECT','VIEW DEFINITION','EXECUTE'],
 a:0,why:'CONTROL is the broadest permission on a securable.',lec:3}
]};
