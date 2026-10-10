/* LearnSphere - Security quiz, Section 09: Security Operations, Hardening & Capstone.
   window.QUIZZES['ora-sec:8']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:8']={qs:[
{q:'Which view finds accounts with **default passwords**?',o:['DBA_USERS_WITH_DEFPWD','DBA_ROLES','V$LOG','DBA_JOBS'],a:0,why:'Fix at once.',lec:0},
{q:'Which parameter should be **FALSE**?',o:['O7_DICTIONARY_ACCESSIBILITY','SQL92_SECURITY','AUDIT_SYS_OPERATIONS','REMOTE_LOGIN_PASSWORDFILE'],a:0,why:'Dictionary access.',lec:0},
{q:'What do you do with **exceptions**?',o:['Record with a reason','Ignore','Delete','Hide'],a:0,why:'Auditors ask.',lec:0},
{q:'When do you **re-check** the baseline?',o:['After every patch or upgrade','Never','Once','Yearly only'],a:0,why:'Drift is normal.',lec:0},
{q:'What should you keep **small and reviewed**?',o:['OS groups such as dba and asmadmin','Logs','Disk','Memory'],a:0,why:'Membership is power.',lec:1},
{q:'Where should container **secrets** come from?',o:['A secret manager at run time','The image','The repository','Environment baked in'],a:0,why:'Not in the image.',lec:1},
{q:'Which SSH setting is **recommended**?',o:['No root login, keys or MFA','Root with password','Open to all','Anonymous'],a:0,why:'Hardening.',lec:1},
{q:'What is the **highest-value** security control?',o:['Patching','Colors','More disks','More indexes'],a:0,why:'Known flaws are the main entry.',lec:2},
{q:'Which patches are **quarterly**?',o:['Release Updates','One-off patches','Fix packs only on demand','None'],a:0,why:'Check MOS for the current cadence.',lec:2},
{q:'Which patch first?',o:['Internet-facing systems','Test systems only','Oldest','Smallest'],a:0,why:'By risk.',lec:2},
{q:'Where do you check **installed SQL patches**?',o:['DBA_REGISTRY_SQLPATCH','DBA_USERS','V$LOG','V$LOCK'],a:0,why:'Also opatch lspatches.',lec:2},
{q:'What stores credentials for **scripts**?',o:['Secure external password store (wallet)','The script','A comment','A table'],a:0,why:'Use /@alias.',lec:3},
{q:'Which wallet **file mode** is suitable?',o:['600 (owner only)','777','666','Any'],a:0,why:'Protect.',lec:3},
{q:'What else can **contain secrets**?',o:['.bash_history and logs','Nothing','Only passwords file','Only backups'],a:0,why:'Command line typing.',lec:3},
{q:'First step of **response**?',o:['Detect','Recover','Learn','Restore'],a:0,why:'Then contain.',lec:4},
{q:'What should you **preserve** first?',o:['Evidence such as audit records','Nothing','Only data','Only logs'],a:0,why:'Before cleaning.',lec:4},
{q:'Which command **contains** a suspect account?',o:['ALTER USER ... ACCOUNT LOCK PASSWORD EXPIRE','DROP TABLE','TRUNCATE','GRANT'],a:0,why:'And kill sessions.',lec:4},
{q:'How often should **failed logons** be reviewed?',o:['Daily','Yearly','Never','Once'],a:0,why:'Early warning.',lec:5},
{q:'Which is a good **indicator**?',o:['Percent of data encrypted','Server color','Folder count','Number of tables'],a:0,why:'Measured monthly.',lec:5},
{q:'Who should receive **privilege reports** monthly?',o:['Management','Nobody','Only the public','Vendors'],a:0,why:'Oversight.',lec:5},
{q:'What proves **encryption works** in the capstone?',o:['Wire capture and datafile strings show nothing','A diagram','A password','A pledge'],a:0,why:'Evidence.',lec:6},
{q:'What should the **application account** be unable to do?',o:['DDL or read other schemas','SELECT own tables','Connect','Insert'],a:0,why:'Least privilege.',lec:6},
{q:'Which self-assessment level means you **attacked your own system**?',o:['Solid','Foundation','Ready','None'],a:0,why:'Controls caught it.',lec:6},
{q:'What does the **incident drill** check?',o:['Locking and evidence within target time','CPU','Backups','Index use'],a:0,why:'Operational readiness.',lec:6},
{q:'DBSAT or CIS scan frequency in the table:',o:['Quarterly','Daily','Never','Yearly only'],a:0,why:'For auditors.',lec:5}
]};
