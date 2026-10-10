/* LearnSphere - Performance quiz, Section 06: SQL Tuning Tools.
   window.QUIZZES['ora-perf:5']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-perf:5']={qs:[
{q:'What does a **SQL Profile** store?',o:['Extra statistics that correct estimates','Hints in the SQL text','The SQL result','A backup'],a:0,why:'SQL text does not change.',lec:0},
{q:'When is a profile **useful**?',o:['When you cannot change the SQL','When you can rewrite it','Never','For DDL'],a:0,why:'Packaged applications.',lec:0},
{q:'Which **package** runs the tuning advisor?',o:['DBMS_SQLTUNE','DBMS_STATS','DBMS_LOCK','UTL_FILE'],a:0,why:'CREATE_TUNING_TASK.',lec:0},
{q:'What does the Tuning Advisor need?',o:['Tuning Pack','Nothing','RAC','Exadata'],a:0,why:'Licensed option.',lec:0},
{q:'The **Access Advisor** works on:',o:['A workload','One SQL only','The OS','Backups'],a:0,why:'Recommends structures.',lec:1},
{q:'Which does the Access Advisor **recommend**?',o:['Indexes and materialized views','Passwords','Users','Parameters only'],a:0,why:'And partitioning.',lec:1},
{q:'What must you **check** before adding recommended indexes?',o:['The effect on DML','The OS version','The password','The listener'],a:0,why:'Indexes slow writes.',lec:1},
{q:'What does **SPM** do?',o:['Uses only accepted plans, evolves new ones','Deletes plans','Compresses SQL','Encrypts SQL'],a:0,why:'Plan stability.',lec:2},
{q:'Which package loads **plans from the cache**?',o:['DBMS_SPM','DBMS_JOB','DBMS_PIPE','DBMS_OUTPUT'],a:0,why:'LOAD_PLANS_FROM_CURSOR_CACHE.',lec:2},
{q:'Which **attribute** says a plan may be used?',o:['ACCEPTED','FIXED only','TAGGED','LOCKED'],a:0,why:'Verified plans.',lec:2},
{q:'What does SPM prevent?',o:['Unproven plans replacing a good one','All hard parses','All parsing','Index use'],a:0,why:'Stability.',lec:2},
{q:'When is a **hint** acceptable?',o:['As a test or documented short-term fix','Everywhere','Never in any case','On every SQL'],a:0,why:'Know why.',lec:3},
{q:'Why do hints **age badly**?',o:['Data and objects change','They are slow','They are encrypted','They are free'],a:0,why:'They hide root cause.',lec:3},
{q:'Which hint sets the **join order**?',o:['LEADING','FULL','PARALLEL','APPEND'],a:0,why:'Plus USE_HASH or USE_NL.',lec:3},
{q:'When does **automatic SQL tuning** run?',o:['In the maintenance window','Every second','Never','At login'],a:0,why:'Nightly.',lec:4},
{q:'Which view lists **automated task clients**?',o:['DBA_AUTOTASK_CLIENT','V$SESSION','DBA_USERS','V$LOG'],a:0,why:'Shows enabled tasks.',lec:4},
{q:'Who owns the **plans** in the end?',o:['You','Oracle','The OS','Nobody'],a:0,why:'Review automation.',lec:4},
{q:'What is a **SQL Patch**?',o:['Hints attached to a SQL without changing the app','A security update','A table','A backup'],a:0,why:'Create with DBMS_SQLDIAG.',lec:5},
{q:'What does **SQL Quarantine** do?',o:['Stops a runaway plan from running again','Backs up SQL','Encrypts SQL','Creates indexes'],a:0,why:'Based on resource limits.',lec:5},
{q:'Where do you check the **licensing** for Quarantine?',o:['Licensing Information guide for your platform','The alert log','V$SESSION','The listener'],a:0,why:'Platform dependent.',lec:5},
{q:'In the practical, what note appears when the **baseline** is used?',o:['SQL plan baseline used for this statement','Parallel','Cardinality feedback','Dynamic sampling'],a:0,why:'In DISPLAY_CURSOR output.',lec:6},
{q:'In the practical, which **view** shows the baseline?',o:['DBA_SQL_PLAN_BASELINES','V$SQL_PLAN only','DBA_USERS','V$LOG'],a:0,why:'ACCEPTED = YES.',lec:6},
{q:'Does SPM make a **bad plan** good?',o:['No, it keeps a good plan from being replaced','Yes','Always','Only with hints'],a:0,why:'Stability, not tuning.',lec:6},
{q:'Which tool first for a **single SQL** you cannot edit?',o:['SQL Tuning Advisor with a profile','Access Advisor','Resize SGA','Restart'],a:0,why:'Profile does not change text.',lec:0},
{q:'Which statistic would an **Access Advisor** workload ideally come from?',o:['A normal busy period','One quiet hour','An empty database','A backup'],a:0,why:'Representative workload.',lec:1}
]};
