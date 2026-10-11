/* LearnSphere - SQL Server Azure SQL & Hybrid quiz, Section 1: Choosing the Platform.
   Format: see pg-quiz.js. window.QUIZZES['mss-az:0']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-az:0']={qs:[
{q:'Which option gives **full OS control** of SQL Server in Azure?',
 o:['SQL Server on Azure VM','Azure SQL Database','Azure SQL Managed Instance','Azure Synapse'],
 a:0,why:'A VM is IaaS, so you manage the OS and the engine.',lec:0},
{q:'Which platform supports **SQL Agent** as a PaaS?',
 o:['Managed Instance','Azure SQL Database single','Neither','Both always'],
 a:0,why:'Managed Instance has SQL Agent. SQL Database uses elastic jobs and other tools.',lec:0},
{q:'What does **PaaS** mean for patching?',
 o:['The provider manages it','You manage OS and SQL patches','Not available','Only in Linux'],
 a:0,why:'In PaaS the platform is maintained by the provider.',lec:0},
{q:'What is a **DTU**?',
 o:['A blended measure of CPU, memory and I/O','A disk unit','A backup unit','A licensing term only'],
 a:0,why:'DTU bundles resources into one number, in the DTU purchasing model.',lec:1},
{q:'Which model allows **Azure Hybrid Benefit**?',
 o:['vCore','DTU only','Both equally','Neither'],
 a:0,why:'The vCore model supports bringing existing licenses.',lec:1},
{q:'Which tier uses **local SSD with replicas** and has a readable replica?',
 o:['Business Critical','General Purpose','Hyperscale only','Basic'],
 a:0,why:'Business Critical uses local storage and Always On replicas.',lec:2},
{q:'Which tier is designed for **very large databases**?',
 o:['Hyperscale','General Purpose','Basic','Standard DTU'],
 a:0,why:'Hyperscale supports up to 100 TB with a distinct architecture.',lec:2},
{q:'A requirement says the app needs a **custom OS-level agent**. Which platform?',
 o:['SQL Server on Azure VM','Azure SQL Database','Managed Instance','Elastic pool'],
 a:0,why:'Only a VM allows OS-level software.',lec:3},
{q:'Many small databases with different peak times fit which option?',
 o:['Elastic pool','Hyperscale','VM','Managed Instance'],
 a:0,why:'A pool shares resources across databases.',lec:3}
]};
