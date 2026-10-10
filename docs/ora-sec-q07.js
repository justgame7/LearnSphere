/* LearnSphere - Security quiz, Section 07: Data Protection: Redaction, Masking, VPD & Database Vault.
   window.QUIZZES['ora-sec:6']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-sec:6']={qs:[
{q:'What comes **first** in data protection?',o:['Discovery and classification','Encryption','Masking','Auditing'],a:0,why:'Know what is sensitive.',lec:0},
{q:'Which tool **scans** for sensitive columns?',o:['DBSAT discover','RMAN','OPatch','TKPROF'],a:0,why:'Also Data Safe.',lec:0},
{q:'What should be kept as a **document**?',o:['The classification list','Passwords','Backups','Trace files'],a:0,why:'Drives all controls.',lec:0},
{q:'Does **Data Redaction** change stored data?',o:['No, only the displayed value','Yes','Only on disk','Only in redo'],a:0,why:'Run-time change.',lec:1},
{q:'Which package manages redaction?',o:['DBMS_REDACT','DBMS_RLS','DBMS_FGA','DBMS_MACADM'],a:0,why:'ADD_POLICY.',lec:1},
{q:'Which function type shows the **last four digits**?',o:['PARTIAL','FULL','RANDOM','NONE'],a:0,why:'Masks the rest.',lec:1},
{q:'Redaction needs which **option**?',o:['Advanced Security','Partitioning','RAC','Diagnostics'],a:0,why:'Licensed.',lec:1},
{q:'What does **VPD** add to a query?',o:['A predicate based on the user','A hint','A sort','An index'],a:0,why:'Row-level security.',lec:2},
{q:'Which package manages VPD?',o:['DBMS_RLS','DBMS_REDACT','DBMS_FGA','DBMS_PRIVILEGE_CAPTURE'],a:0,why:'ADD_POLICY.',lec:2},
{q:'Who bypasses VPD?',o:['Users with EXEMPT ACCESS POLICY','Everyone','Nobody','Only SYS'],a:0,why:'Control that privilege.',lec:2},
{q:'What must set the **application context**?',o:['A trusted package','The user','The OS','The listener'],a:0,why:'Users must not alter it.',lec:2},
{q:'What does **OLS** compare?',o:['User label against row label','Passwords','Tablespaces','Times'],a:0,why:'Dominance model.',lec:3},
{q:'Which are OLS label components?',o:['Level','Compartment','Group','Index'],a:[0,1,2],why:'Not index.',lec:3},
{q:'When is **OLS** better than VPD?',o:['A real classification scheme','Any row filter','Never','Always'],a:0,why:'VPD is simpler for custom rules.',lec:3},
{q:'What does a **realm** do?',o:['Protects objects even from privileged users','Compresses','Indexes','Partitions'],a:0,why:'Database Vault.',lec:4},
{q:'What does a **command rule** do?',o:['Allows or blocks a statement under a condition','Creates users','Backs up','Moves files'],a:0,why:'For example DROP TABLE only in a window.',lec:4},
{q:'What must you test with **Database Vault**?',o:['Patching, backups, upgrades','Nothing','Only SELECT','Only users'],a:0,why:'It changes administration.',lec:4},
{q:'Is masking **reversible**?',o:['No, it is permanent','Yes always','Only partly','Only with keys'],a:0,why:'Real values removed.',lec:5},
{q:'What must masking **preserve**?',o:['Referential integrity','Real names','Passwords','Backups'],a:0,why:'Same input same output.',lec:5},
{q:'When should data be **masked**?',o:['Before it leaves production boundary','After release to developers','Never','On demand by developers'],a:0,why:'Avoid leaks.',lec:5},
{q:'Which control hides **rows**?',o:['VPD','Redaction','Masking','TDE'],a:0,why:'Predicate.',lec:6},
{q:'Which control blocks the **DBA**?',o:['Database Vault realm','Redaction','Profile','Index'],a:0,why:'Separation of duties.',lec:6},
{q:'Does one control **replace** the others?',o:['No, each answers a different question','Yes','Only VPD','Only TDE'],a:0,why:'Layers.',lec:6},
{q:'Where is real data **after** redaction?',o:['Unchanged in the table','Deleted','In a vault','In redo only'],a:0,why:'Only display changes.',lec:1},
{q:'Which technique **shuffles** values among rows?',o:['Shuffle masking','Substitution','Nulling','Subsetting'],a:0,why:'Keeps distribution.',lec:5}
]};
