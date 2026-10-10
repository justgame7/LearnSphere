/* LearnSphere - Upgrade quiz, Section 01: Release, Patch & Lifecycle Fundamentals.
   window.QUIZZES['ora-upg:0']. lec = lecture index in the section. x:1 = additional content (none yet). */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['ora-upg:0']={qs:[
{q:'Which release type has **years of support**?',o:['Long-Term Release','Innovation Release','Beta','Preview'],a:0,why:'19c and 26ai.',lec:0},
{q:'Which release does production normally run?',o:['Long-term','Innovation','Preview','Any'],a:0,why:'Stability and support.',lec:0},
{q:'What is a **Release Update**?',o:['Quarterly bundle of fixes','A new release','A license','A tool'],a:0,why:'Security, bug and regression fixes.',lec:0},
{q:'Moving **between** releases is called:',o:['Upgrade','Patching','Backup','Cloning'],a:0,why:'Within a release it is patching.',lec:0},
{q:'Which patch fixes **one bug**?',o:['One-off (interim)','Release Update','CPU','Bundle'],a:0,why:'Specific problem.',lec:1},
{q:'Is an **RU cumulative**?',o:['Yes, it includes earlier RUs','No','Only security','Only bugs'],a:0,why:'Apply a later one directly.',lec:1},
{q:'What may be needed when a one-off conflicts?',o:['A merge patch','A backup','A restart','A new user'],a:0,why:'Check with opatch prereq.',lec:1},
{q:'Which is a **platform bundle**?',o:['Exadata or Windows bundle','RU','CPU','OJVM'],a:0,why:'Platform specific.',lec:1},
{q:'What is a **CSPU**?',o:['Security-only fixes on a monthly stream','A new release','A backup','A table'],a:0,why:'Newer model.',lec:2},
{q:'What helps with **frequent** patches?',o:['Automation and gold images','Manual steps','No testing','Skipping'],a:0,why:'Standard slot and rollback.',lec:2},
{q:'Where do you find **exact** patch cadence?',o:['The current Oracle announcement','This course only','A blog','Memory'],a:0,why:'It can change.',lec:2},
{q:'Which support level has **no new fixes**?',o:['Sustaining Support','Premier Support','Extended Support','Error correction'],a:0,why:'Existing patches only.',lec:3},
{q:'How early should you **start** an upgrade project?',o:['12 to 18 months before the end date','The week before','After the end','Never'],a:0,why:'Projects take months.',lec:3},
{q:'Which MOS note has **release dates**?',o:['Doc ID 742060.1','Doc ID 1','Doc ID 999','Any'],a:0,why:'Support timeline.',lec:3},
{q:'What should be updated **first**?',o:['OPatch','The OS name','The listener port','The SGA'],a:0,why:'Old OPatch causes failures.',lec:4},
{q:'Which README section lists **datapatch**?',o:['Post-install','Download notes','Known issues','Prerequisites'],a:0,why:'SQL changes.',lec:4},
{q:'What is **OPatch** download patch number?',o:['6880880','1','100','123'],a:0,why:'On MOS.',lec:4},
{q:'Which **order** for environments?',o:['Non-production first','Production first','Random','Only prod'],a:0,why:'Test before prod.',lec:5},
{q:'Which method is **preferred**?',o:['Out-of-place with gold images','In-place only','Manual file copy','No method'],a:0,why:'Faster rollback.',lec:5},
{q:'How far should you stay **behind** on RUs?',o:['At most one RU','Many','Never patch','Ten'],a:0,why:'Skipping makes it harder.',lec:5},
{q:'Where do you find a **database patch level**?',o:['DBA_REGISTRY_SQLPATCH','DBA_USERS','V$LOG','V$LOCK'],a:0,why:'Also opatch lspatches.',lec:6},
{q:'What must the calendar have **before** production?',o:['A test date','Nothing','A holiday','A party'],a:0,why:'Test first.',lec:6},
{q:'What should each database have?',o:['An owner and a rollback method','A color','A nickname','Nothing'],a:0,why:'Responsibility.',lec:6},
{q:'Why automate the **inventory**?',o:['Manual lists decay quickly','It is required','It is fun','No reason'],a:0,why:'Keep data current.',lec:6},
{q:'What decides **how long** you are supported?',o:['The release you run','The OS color','The disk','The user count'],a:0,why:'Support policy.',lec:0}
]};
