/* LearnSphere - SQL Server Azure SQL & Hybrid quiz, Section 4: SQL Server on Azure VMs.
   Format: see pg-quiz.js. window.QUIZZES['mss-az:3']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-az:3']={qs:[
{q:'What limits **disk performance** on an Azure VM?',
 o:['Both the disk and the VM size','Only the disk','Only the OS','Nothing'],
 a:0,why:'The VM size caps IOPS and throughput in addition to disk limits.',lec:0},
{q:'Which **cache setting** is recommended for the log disk?',
 o:['None','ReadOnly','ReadWrite','Both'],
 a:0,why:'Log data is written sequentially, and caching does not help.',lec:0},
{q:'What does the **SQL IaaS Agent extension** provide?',
 o:['Portal management, automated backup and patching','New hardware','Free licenses','Auto tuning of queries'],
 a:0,why:'It integrates the VM with Azure management features.',lec:1},
{q:'Which license types can be set through the extension?',
 o:['Pay as you go','Azure Hybrid Benefit','Disaster recovery','Free forever'],
 a:[0,1,2],why:'These license types are supported options.',lec:1},
{q:'What should you do about **backups** on a VM?',
 o:['Configure and test them yourself or with automated backup','Nothing, Azure does it all','Disable them','Use only snapshots of the OS'],
 a:0,why:'On IaaS you are responsible, with tools available.',lec:2},
{q:'Which backup option gives a **central vault and policies**?',
 o:['Azure Backup for SQL in VMs','Local disk only','Replication','Query Store'],
 a:0,why:'Azure Backup provides a vault with policies and retention.',lec:2},
{q:'How is the **AG listener** typically built in Azure?',
 o:['Internal load balancer or DNN','Windows hosts file','Public IP only','DHCP'],
 a:0,why:'Azure networking does not support gratuitous ARP, so a load balancer or DNN is used.',lec:3},
{q:'Which gives **zone-level** protection?',
 o:['Replicas in different availability zones','One VM','One disk','Backup only'],
 a:0,why:'Replicas in separate zones survive a zone failure.',lec:3}
]};
