/* LearnSphere - Upgrade quiz, Section 04: Upgrading with AutoUpgrade.
   window.QUIZZES['ora-upg:3']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-upg:3']={qs:[
{q:'What is **AutoUpgrade**?',o:['A Java tool driven by a config file','A GUI only','A kernel module','A backup'],a:0,why:'Single jar.',lec:0},
{q:'Where should you get **autoupgrade.jar**?',o:['My Oracle Support (latest)','Any site','From the OS','Never'],a:0,why:'Updated often.',lec:0},
{q:'Which parameter names the **old home**?',o:['source_home','target_home','log_dir','sid'],a:0,why:'target_home is the new one.',lec:0},
{q:'Which creates a **restore point**?',o:['restoration=yes','start_time','log_dir','sid'],a:0,why:'Fallback.',lec:0},
{q:'Which mode only **checks**?',o:['analyze','deploy','upgrade','fixups'],a:0,why:'No changes.',lec:1},
{q:'Which mode does **everything**?',o:['deploy','analyze','fixups','postfixups'],a:0,why:'Analyze, fixups, upgrade, post.',lec:1},
{q:'When should you run **fixups**?',o:['Days ahead of the window','Never','At the same time as deploy always','After upgrade'],a:0,why:'Less on the night.',lec:1},
{q:'Which console command **lists jobs**?',o:['lsj','ls','list','jobs'],a:0,why:'Then status -job n.',lec:1},
{q:'What does CDB upgrade handle?',o:['Root, seed and PDBs','Only root','Only PDBs','Only seed'],a:0,why:'One operation.',lec:2},
{q:'Which parameter selects **PDBs**?',o:['pdbs','sid','patch','target_cdb'],a:0,why:'List.',lec:2},
{q:'An un-upgraded PDB plugged in is:',o:['Restricted','Open to all','Deleted','Read only'],a:0,why:'Upgrade it first.',lec:2},
{q:'How do you know the **duration**?',o:['Rehearse on a copy','Guess','Ask Oracle','Never'],a:0,why:'Measure.',lec:2},
{q:'Which parameter names the **target CDB**?',o:['target_cdb','source_home','sid','pdbs'],a:0,why:'For conversion.',lec:3},
{q:'The **same files** option for plug-in is:',o:['Fastest but harder fallback','Slowest','Safest','Unsupported'],a:0,why:'Verify backup.',lec:3},
{q:'Which keeps applications working after conversion?',o:['A service with the old name','New code','A new password','A restart'],a:0,why:'Connect by service.',lec:3},
{q:'Which method upgrades **PDB by PDB**?',o:['Unplug/plug','Whole CDB','Replay','Clone'],a:0,why:'Different schedules.',lec:4},
{q:'What does **replay upgrade** reduce?',o:['Outage, keeping the original untouched','Space','Memory','Users'],a:0,why:'Upgrade a clone.',lec:4},
{q:'Which script **recompiles** invalid objects?',o:['utlrp.sql','catalog.sql','utlpwdmg.sql','dbmspool.sql'],a:0,why:'Run after upgrade.',lec:5},
{q:'What should you **gather** after upgrade?',o:['Dictionary and fixed object statistics','Nothing','Only users','Only logs'],a:0,why:'Performance.',lec:5},
{q:'What should happen to **COMPATIBLE**?',o:['Raise later as a separate change','Raise at once','Never','Delete'],a:0,why:'After stabilisation.',lec:5},
{q:'What does **-restore** do?',o:['Uses the restore point to go back','Upgrades','Analyzes','Patches'],a:0,why:'Fallback.',lec:6},
{q:'When is downgrade **impossible**?',o:['After COMPATIBLE is raised','Always','Never','Before upgrade'],a:0,why:'Point of no return.',lec:6},
{q:'In the practical, what must be valid in `DBA_REGISTRY`?',o:['All components','Nothing','Only one','None'],a:0,why:'Version 26.',lec:7},
{q:'Where are the **evidence** logs stored?',o:['With the change record','Deleted','Nowhere','Public'],a:0,why:'Auditable.',lec:7},
{q:'What shows the PDB is **not restricted**?',o:['V$PDBS','V$LOG','DBA_USERS','V$LOCK'],a:0,why:'Check open mode.',lec:7}
]};
