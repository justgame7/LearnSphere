/* LearnSphere - SQL Server Azure SQL & Hybrid quiz, Section 3: Azure SQL Managed Instance.
   Format: see pg-quiz.js. window.QUIZZES['mss-az:2']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-az:2']={qs:[
{q:'Where does a Managed Instance **live**?',
 o:['In a dedicated subnet of your virtual network','On a shared public host','Inside a storage account','On your datacenter'],
 a:0,why:'Managed Instance is injected into your VNet in its own subnet.',lec:0},
{q:'Which feature is **supported** in Managed Instance?',
 o:['Cross-database queries','OS-level agent installs','Full OS access','Custom drivers'],
 a:0,why:'Instance-level features are supported. OS access is not.',lec:0},
{q:'The MI subnet must be:',
 o:['Dedicated and delegated','Shared with VMs','Public','Unlimited in size without planning'],
 a:0,why:'It is dedicated to MI and delegated to Microsoft.Sql.',lec:1},
{q:'What should you do with the **NSG rules** the service creates?',
 o:['Keep them: do not remove','Delete','Open all','Rename'],
 a:0,why:'The service depends on them to manage the instance.',lec:1},
{q:'Which method gives **short downtime** migration to MI?',
 o:['Log Replay Service or MI link','Copy files manually','Export to CSV','Manual rewrite'],
 a:0,why:'Both keep applying changes until a short cutover.',lec:2},
{q:'Which statement restores from Azure Blob on MI?',
 o:['RESTORE DATABASE ... FROM URL','ATTACH FROM BLOB','COPY FROM URL','IMPORT BACPAC'],
 a:0,why:'MI supports native restore from URL.',lec:2},
{q:'How many **management operations** can run at once on an instance?',
 o:['One','Many','Two','Unlimited'],
 a:0,why:'Operations such as scale and update are serialized.',lec:3},
{q:'Why use **maintenance windows**?',
 o:['To control when updates happen','To speed up queries','To encrypt data','To save storage'],
 a:0,why:'You choose a window with lower business impact.',lec:3}
]};
