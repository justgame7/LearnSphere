/* LearnSphere - Upgrade quiz, Section 06: Fleet Patching & Lifecycle Automation.
   window.QUIZZES['ora-upg:5']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-upg:5']={qs:[
{q:'What is a **gold image**?',o:['A tested patched home as a file','A backup','A log','A script'],a:0,why:'Build every home from it.',lec:0},
{q:'Why use gold images?',o:['Consistency and speed','Fewer disks','More users','Larger SGA'],a:0,why:'Identical homes.',lec:0},
{q:'How should an image be **built**?',o:['In a clean environment from base plus RU','From any ad hoc home','From a laptop','Randomly'],a:0,why:'Repeatable.',lec:0},
{q:'What should the image **name** include?',o:['Release, RU and date','Owner password','Nothing','Disk size'],a:0,why:'Know what is current.',lec:0},
{q:'What does **FPP** manage?',o:['Many homes and databases from one place','One database','The network','The OS only'],a:0,why:'Images, patching, provisioning.',lec:1},
{q:'What is a **working copy** in FPP?',o:['A home built from an image on a target','A backup','A user','A log'],a:0,why:'Gold image applied.',lec:1},
{q:'Is FPP the only way to automate?',o:['No, scripts and Ansible work too','Yes','Only with Exadata','Only in cloud'],a:0,why:'FPP adds integration.',lec:1},
{q:'Which step should you automate **first**?',o:['The checks','The restart','The deletion','The reboot'],a:0,why:'Safest and often skipped.',lec:2},
{q:'What does **idempotent** mean?',o:['Running twice does no harm','Runs once only','Fast','Encrypted'],a:0,why:'Important for automation.',lec:2},
{q:'Where do **passwords** go in playbooks?',o:['A vault, never in the file','The playbook','A comment','The log'],a:0,why:'Security.',lec:2},
{q:'What should every automation have?',o:['A dry-run or evaluation mode','No logs','No tests','Root password'],a:0,why:'Safe testing.',lec:2},
{q:'What shows the **patch level** of a database?',o:['DBA_REGISTRY_SQLPATCH','DBA_USERS','V$LOG','V$LOCK'],a:0,why:'Plus opatch lspatches.',lec:3},
{q:'Which metric shows **compliance**?',o:['Percent within one RU of current','Number of tables','Disk size','User count'],a:0,why:'Measured monthly.',lec:3},
{q:'How should the inventory be **collected**?',o:['Automatically and daily','Manually yearly','Never','On request'],a:0,why:'Fresh data.',lec:3},
{q:'In **Data Guard** patching, which goes first?',o:['The standby','The primary','Either','Neither'],a:0,why:'Or rolling method.',lec:4},
{q:'In **RAC**, which goes first?',o:['Grid Infrastructure, node by node','The database only','The OS only','Nothing'],a:0,why:'Rolling.',lec:4},
{q:'How often do you run **datapatch** in RAC?',o:['Once at the end','On every node','Never','Twice'],a:0,why:'Dictionary is shared.',lec:4},
{q:'What helps sessions move before a node stops?',o:['Service drain and Application Continuity','Reboot','Kill all','Nothing'],a:0,why:'Planned maintenance.',lec:4},
{q:'What is the **aim** of automating patch cycles?',o:['Repeatable and auditable','Fewer people','Faster only','Cheaper only'],a:0,why:'Not dependent on one person.',lec:5},
{q:'What does the pre-check script verify?',o:['OPatch version, space, backup age','Colors','Passwords','Cables'],a:0,why:'Before the change.',lec:5},
{q:'What should the verification **include**?',o:['Patch level, components, smoke test','Nothing','Only SELECT 1','Only ping'],a:0,why:'Proof.',lec:5},
{q:'Where should the order of patching be **kept**?',o:['In the runbook','In memory','Nowhere','In email only'],a:0,why:'Avoid 2 a.m. mistakes.',lec:4},
{q:'Which is a licensing note for **FPP**?',o:['Check licensing for your use','Always free','Never licensed','Only for Windows'],a:0,why:'Read the guide.',lec:1}
]};
