/* LearnSphere - Upgrade quiz, Section 02: Patching with OPatch & Datapatch.
   window.QUIZZES['ora-upg:1']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-upg:1']={qs:[
{q:'Which command lists **installed patches**?',o:['opatch lspatches','opatch apply','opatch rollback','opatch delete'],a:0,why:'Also lsinventory.',lec:0},
{q:'As which user do you run **OPatch**?',o:['The software owner','root always','Any','nobody'],a:0,why:'Avoid ownership problems.',lec:0},
{q:'Where is the **central inventory**?',o:['oraInventory','ORACLE_HOME/bin','/tmp','The SPFILE'],a:0,why:'Listed in oraInst.loc.',lec:0},
{q:'What should you update **first**?',o:['OPatch','The database','The SGA','The listener'],a:0,why:'README minimum.',lec:0},
{q:'What does `opatch prereq` check?',o:['Conflicts and space','Passwords','Backups','Users'],a:0,why:'Before the outage.',lec:1},
{q:'What do you do on a **conflict**?',o:['Get a merge patch or use an RU containing the fix','Ignore','Force','Delete inventory'],a:0,why:'Never ignore.',lec:1},
{q:'Which backup before patching?',o:['Home and database','Only home','Nothing','Only logs'],a:0,why:'Rollback readiness.',lec:1},
{q:'What is the **order** of in-place patching?',o:['Stop, patch, start, datapatch','Datapatch, patch, stop','Start, patch','Patch while running'],a:0,why:'Binary then SQL.',lec:2},
{q:'What is the **risk** of in-place?',o:['Half-patched home on failure','No risk','Faster','Free'],a:0,why:'Harder rollback.',lec:2},
{q:'Which has a **shorter outage**?',o:['Out-of-place','In-place','Same','Neither'],a:0,why:'Switch homes.',lec:2},
{q:'What does **datapatch** change?',o:['SQL objects in the data dictionary','Binaries','Network','Backups'],a:0,why:'And records them.',lec:3},
{q:'Where do you verify **SQL patches**?',o:['DBA_REGISTRY_SQLPATCH','DBA_USERS','V$LOG','V$LOCK'],a:0,why:'Status SUCCESS.',lec:3},
{q:'In RAC, how often do you run **datapatch**?',o:['Once from one node','On every node','Never','Twice'],a:0,why:'Dictionary is shared.',lec:3},
{q:'Closed PDBs need:',o:['Datapatch when opened','Nothing','A new DBID','Restart OS'],a:0,why:'They are not patched yet.',lec:3},
{q:'What is a **gold image**?',o:['A zipped patched home used to build new homes','A backup','A log','A listener'],a:0,why:'Standard home.',lec:4},
{q:'Which is the **fastest rollback**?',o:['Switch back to the old home','Restore backups','Reinstall','Rebuild'],a:0,why:'Old home untouched.',lec:4},
{q:'Which command creates a **gold image**?',o:['runInstaller -createGoldImage','opatch apply','datapatch','rman'],a:0,why:'Destination location.',lec:4},
{q:'What do you roll back **first**?',o:['SQL changes (datapatch rollback)','Binaries','OS','Network'],a:0,why:'Then binaries.',lec:5},
{q:'Where are **opatch logs**?',o:['$ORACLE_HOME/cfgtoollogs/opatch','/dev/null','The alert log only','/etc'],a:0,why:'Read them.',lec:5},
{q:'Wrong patch applied. What do you use?',o:['opatch rollback -id','opatch apply','opatch lsinventory only','delete files'],a:0,why:'By patch ID.',lec:5},
{q:'What does AutoUpgrade **patch mode** do?',o:['Downloads, builds home, patches, switches','Only checks','Only backs up','Nothing'],a:0,why:'One config file.',lec:6},
{q:'What does AutoUpgrade need to **download** patches?',o:['MOS credentials in a keystore','A password in the file','Nothing','A license key'],a:0,why:'Secure storage.',lec:6},
{q:'In the practical, what is **recorded**?',o:['Timing for each step','Nothing','Passwords','Disk colors'],a:0,why:'Outage estimate.',lec:7},
{q:'How much **margin** for the production plan?',o:['About 50 percent','0','500 percent','None'],a:0,why:'Surprises happen.',lec:7},
{q:'After rollback, which shows the **old patch level**?',o:['lspatches and the SQL patch registry','Nothing','Listener log','Alert only'],a:0,why:'Verify.',lec:7},
{q:'In-place patching is acceptable for:',o:['Small systems','All production','Nothing','RAC only'],a:0,why:'Production prefers out-of-place.',lec:2}
]};
