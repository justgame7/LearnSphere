/* LearnSphere - SQL Server Azure SQL & Hybrid quiz, Section 5: Security in Azure SQL.
   Format: see pg-quiz.js. window.QUIZZES['mss-az:4']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-az:4']={qs:[
{q:'Which is best for **application** access without passwords?',
 o:['Managed identity','Shared sa','Password in config','Anonymous'],
 a:0,why:'A managed identity needs no secret.',lec:0},
{q:'Which statement creates a user for an **Entra group**?',
 o:['CREATE USER [group] FROM EXTERNAL PROVIDER','CREATE LOGIN ... WITH PASSWORD','ALTER USER ... GROUP','GRANT ENTRA'],
 a:0,why:'FROM EXTERNAL PROVIDER maps an Entra principal to a database user.',lec:0},
{q:'What closes the **public endpoint**?',
 o:['Deny public network access','Allow Azure services','Open all IPs','Rename the server'],
 a:0,why:'This setting disables public connectivity entirely.',lec:1},
{q:'What must be planned with **private endpoints**?',
 o:['Private DNS resolution','A larger log','More backups','A new collation'],
 a:0,why:'The server name must resolve to the private IP.',lec:1},
{q:'Is **TDE** on by default in Azure SQL Database?',
 o:['Yes, with a service-managed key','No','Only for Premium','Only with Key Vault'],
 a:0,why:'TDE is enabled by default with a service-managed key.',lec:2},
{q:'What is a **risk** of customer-managed keys?',
 o:['Losing key access makes the database inaccessible','Slower queries always','Higher licenses','No backups'],
 a:0,why:'Revoking or losing the key blocks the database, so protect the vault.',lec:2},
{q:'Where can **audit logs** be sent?',
 o:['Log Analytics','Storage account','Event Hubs','Local C: drive'],
 a:[0,1,2],why:'Auditing writes to Azure destinations, not a local disk.',lec:3},
{q:'Which service provides **vulnerability assessment and threat detection**?',
 o:['Microsoft Defender for SQL','Azure Backup','Azure Monitor metrics only','Azure DNS'],
 a:0,why:'Defender for SQL covers both.',lec:3}
]};
