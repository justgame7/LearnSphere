/* LearnSphere - Upgrade quiz, Section 03: Upgrade Planning & Compatibility.
   window.QUIZZES['ora-upg:2']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-upg:2']={qs:[
{q:'Which source gives a **direct** upgrade to 26ai?',o:['19c at a supported RU','11.2.0.3','10g','9i'],a:0,why:'Check the guide.',lec:0},
{q:'What if the source is **12.1**?',o:['Upgrade to 19c first, or migrate','Direct','Impossible always','Reinstall'],a:0,why:'Two steps or other method.',lec:0},
{q:'Where are **supported paths** listed?',o:['Upgrade Guide of the target release','A blog','A forum','Memory'],a:0,why:'Authoritative.',lec:0},
{q:'What else do you check **before** deciding?',o:['Application certification','Disk color','Mouse','Printer'],a:0,why:'Third-party support.',lec:0},
{q:'What architecture does **26ai** support?',o:['Multitenant (CDB) only','Non-CDB','Both equally','Neither'],a:0,why:'Convert non-CDBs.',lec:1},
{q:'Policy-managed RAC databases are:',o:['Not supported in newer releases','Required','Preferred','Faster'],a:0,why:'Move to administrator-managed.',lec:1},
{q:'How do you find **issues** early?',o:['AutoUpgrade analyze','Guess','Wait','Upgrade'],a:0,why:'Reports errors and warnings.',lec:1},
{q:'Where do you check **removed** features?',o:['The release Upgrade Guide','The alert log','The listener','The SGA'],a:0,why:'Desupported chapter.',lec:1},
{q:'Which AutoUpgrade mode only **checks**?',o:['analyze','deploy','fixups','upgrade'],a:0,why:'No changes.',lec:2},
{q:'What must be fixed **before** the upgrade?',o:['Errors','Nothing','Only warnings','Only info'],a:0,why:'Warnings are reviewed.',lec:2},
{q:'What are **fixups**?',o:['Automatic changes done by AutoUpgrade','Backups','Patches','Users'],a:0,why:'In fixups or deploy mode.',lec:2},
{q:'How often to run **analyze**?',o:['Early and repeatedly','Once','Never','At the end'],a:0,why:'Costs nothing.',lec:2},
{q:'What does raising **COMPATIBLE** prevent?',o:['Downgrade of the database','Upgrade','Backup','Restart'],a:0,why:'Commitment point.',lec:3},
{q:'When should you raise COMPATIBLE?',o:['After the new release is proven','Before the upgrade','At the same second','Never'],a:0,why:'Separate change.',lec:3},
{q:'Which **character set** is recommended?',o:['AL32UTF8','US7ASCII','WE8ISO8859P1','EBCDIC'],a:0,why:'Holds all characters.',lec:3},
{q:'Which fallback is **fastest**?',o:['Guaranteed restore point','Backup restore','Reinstall','Rebuild'],a:0,why:'FLASHBACK DATABASE.',lec:4},
{q:'What is the limit of a **restore point** fallback?',o:['Changes made after the upgrade are lost','Needs tape','Needs RAC','No limit'],a:0,why:'Rewinds the database.',lec:4},
{q:'Why **rehearse** fallback?',o:['A fallback never tried is a hope','Required','Free','Faster'],a:0,why:'Test upgrade.',lec:4},
{q:'Which tool compares **SQL before and after**?',o:['SQL Performance Analyzer','RMAN','OPatch','TKPROF'],a:0,why:'RAT option.',lec:5},
{q:'Which **replays** a production workload?',o:['Database Replay','AWR','ASH','Statspack'],a:0,why:'Needs RAT.',lec:5},
{q:'What pins **known good plans**?',o:['SQL Plan Management','Hints only','Statistics only','Nothing'],a:0,why:'Baselines.',lec:5},
{q:'In the practical, what is the **first** step?',o:['Get the latest AutoUpgrade','Upgrade production','Drop users','Reboot'],a:0,why:'Then analyze.',lec:6},
{q:'What is done with **totals** across the estate?',o:['They become the project plan','Nothing','Deleted','Hidden'],a:0,why:'Effort estimate.',lec:6},
{q:'Which parameter list matters for **deprecated** check?',o:['Non-default deprecated parameters','All parameters','No parameter','Only hidden'],a:0,why:'In use.',lec:1}
]};
