/* LearnSphere - MySQL, Section 01: Introduction & MySQL Foundations.
   Lectures 0-7 are core. Needs mysql-common.js. */
(function(){
const K=window.MY,L=window.LESSONS;

const path=K.dg(700,200,[
[10,10,680,180,'The learning path',1],
[25,60,100,60,'SQL and|data types',0],[145,60,100,60,'Joins and|advanced SQL',0],[265,60,100,60,'Design and|stored code',0],[385,60,100,60,'InnoDB and|transactions',0],[505,60,80,60,'Indexes and|tuning',0],[605,60,70,60,'Operate',2]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,605,90]]);

const place=K.dg(700,210,[
[10,10,680,190,'Where MySQL usually sits',1],
[30,70,120,60,'Application|servers',0],[240,70,140,60,'MySQL|primary',2],[500,40,160,50,'Replicas|reads and backups',0],[500,120,160,50,'Disk: data files|redo, binary log',0]],
[[150,100,240,100],[380,100,500,65],[380,100,500,145]]);

const layers=K.dg(700,330,[
[10,10,680,310,'One MySQL server (mysqld)',1],
[30,40,640,46,'Connection layer: authentication, threads, SSL, connection limits',0],
[30,100,640,46,'SQL layer: parser, privilege check, optimizer, executor, caches of metadata',2],
[30,160,640,46,'Storage engine API (handler interface)',0],
[30,220,200,50,'InnoDB|default, transactional',2],[250,220,200,50,'MyISAM, MEMORY, CSV|special purpose',0],[470,220,200,50,'Files on disk|data, redo, undo, binlog',0]],
[[350,86,350,100],[350,146,350,160],[130,206,130,220],[350,206,350,220],[570,206,570,220]]);

/* ---------- 0 ---------- */
L['mysql:0:0']={blocks:[
{p:'**MySQL** is the most widely deployed open source relational database. Web applications, SaaS platforms, content systems and data pipelines use it to store structured data, query it with SQL and keep it consistent when many users change it at once. This course takes you from your first query to running MySQL in production.'},
{h:'What you will be able to do'},
{ul:['Write correct, readable SQL: filtering, grouping, joins, subqueries, CTEs and window functions.','Choose data types and design normalized schemas with proper keys and constraints.','Explain how InnoDB stores data, logs changes and recovers from a crash.','Use transactions, isolation levels and locks without surprises.','Design indexes, read EXPLAIN output and fix slow queries.','Configure, monitor and secure a server, and take and test backups.','Run replication and understand InnoDB Cluster, then upgrade and troubleshoot with a method.']},
{svg:path},
{h:'Prerequisites'},
{t:[['You should know','If not'],
['Basic command line use','Practise running commands in a terminal: cd, ls, editing files'],
['What a table of data looks like','Think of a spreadsheet with named columns. The first sections build the rest'],
['Nothing about SQL','No problem. Sections 2 to 5 teach SQL from the start'],
['Basic networking: host and port','MySQL listens on TCP port 3306 by default']]},
{h:'How to use the course'},
{ul:['Sections build on one another. Complete sections 1 to 5 before the later ones.','Run every statement on a scratch server. A Docker container is enough.','Each section ends with a quiz. Use the quick reference for revision and maps for the big picture.','If you already know SQL, skim sections 2 to 6 and start carefully at InnoDB and transactions.']},
{note:'The baseline is MySQL 8.4 LTS. Features that need a different version are marked. 8.0 reached end of life in April 2026, so new work should start on 8.4 or 9.7 LTS. Always read the release notes for the version you run.'}],
src:[['MySQL 8.4 Reference Manual',K.D],['MySQL documentation home',K.MGT]]};

/* ---------- 1 ---------- */
L['mysql:0:1']={blocks:[
{p:'A **relational database** stores data in tables made of rows and columns, and lets you relate tables to each other through shared values called keys. **MySQL** is a relational database management system (RDBMS): software that stores the data, enforces rules on it, and answers questions written in **SQL** (Structured Query Language).'},
{h:'Client and server'},
{p:'MySQL follows a client/server model. The server process, called `mysqld`, owns the data. Applications and tools are clients: they open a connection, send SQL statements, and receive results.'},
{svg:place},
{h:'What MySQL is good at'},
{t:[['Strength','What it means in practice'],
['Transactions and integrity','InnoDB gives ACID transactions, foreign keys and constraints'],
['Read-heavy web workloads','Fast point lookups and range scans with good indexes'],
['Ecosystem','Connectors for every language, many tools, widespread hosting and managed services'],
['Replication','Built-in copy of data to replicas for reads, backups and failover'],
['Familiarity','Large pool of people who know it, plenty of documentation']]},
{h:'Where something else may fit better'},
{ul:['**Heavy analytics over huge datasets.** Column stores and warehouses are built for this. MySQL HeatWave adds an analytics engine.','**Very advanced SQL and extensibility.** PostgreSQL has a larger feature set in some areas.','**Pure key-value speed.** A cache such as Redis is faster for simple lookups held in memory.','**Flexible documents at scale.** A document database may fit better, although MySQL has a JSON type.']},
{h:'SQL in one paragraph'},
{p:'SQL is **declarative**. You describe the result you want, not how to compute it. The server decides which indexes to use and in what order to read tables. That is why you learn two things: how to ask correctly, and how the server answers, which is the basis for tuning.'},
{code:`-- Ask for the result, not the steps
SELECT customer_id, SUM(total) AS spent
FROM orders
WHERE status = 'paid'
GROUP BY customer_id
ORDER BY spent DESC
LIMIT 5;`},
{note:'SQL is a standard, but every database adds its own dialect. This course teaches the MySQL dialect and points out where it differs from the standard.'}],
src:[['What is MySQL',K.D+'preface.html'],['SQL statements',K.D+'sql-statements.html']]};

/* ---------- 2 ---------- */
L['mysql:0:2']={blocks:[
{p:'There is more than one thing called MySQL, and the version number tells you what you can rely on. Knowing the editions and release model prevents wrong assumptions about features, support and upgrades.'},
{h:'Release model'},
{p:'Oracle ships two kinds of release. **LTS (long-term support)** releases are stable and receive bug and security fixes for years. **Innovation** releases arrive about every quarter, bring new features sooner and are supported only until the next one.'},
{t:[['Release line','Type','Notes'],
['MySQL 8.0','Former LTS','Reached end of life in April 2026. Plan to leave it'],
['MySQL 8.4','LTS','The baseline of this course. Eight years of support from release'],
['MySQL 9.0 to 9.6','Innovation','Short-lived, good for trying features such as the VECTOR type'],
['MySQL 9.7','LTS','The next long-term line, released April 2026']]},
{p:'A version reads as **major.minor.patch**, for example 8.4.5. Within an LTS line, patch releases only fix problems. Pick an LTS for production and test innovation releases only if you need a new feature.'},
{h:'Editions'},
{t:[['Edition','Licence','What you get'],
['MySQL Community Server','GPL, free','The full server, InnoDB, replication, Group Replication, MySQL Shell and Router'],
['MySQL Enterprise Edition','Commercial','Adds enterprise audit, firewall, thread pool, enterprise backup, TDE key managers and support'],
['MySQL HeatWave','Oracle Cloud, also AWS and Azure','Managed MySQL with an in-memory analytics engine and machine learning features'],
['MySQL Cluster (NDB)','GPL or commercial','A different, distributed in-memory product. Not the same as InnoDB Cluster']]},
{note:'MySQL Cluster (NDB) and **InnoDB Cluster** have similar names but are unrelated technologies. This course covers InnoDB Cluster.'},
{h:'Forks and compatible servers'},
{t:[['Product','Relationship to MySQL','Use'],
['MariaDB','Fork from 2009, now diverging','Different features, storage engines and replication details. Not a drop-in replacement for current MySQL'],
['Percona Server for MySQL','Enhanced build of MySQL','Adds extra monitoring, audit and thread pool, with the Percona Toolkit and XtraBackup alongside'],
['Amazon Aurora MySQL','MySQL-compatible managed service','Different storage layer, compatible protocol and SQL'],
['TiDB, Vitess and others','MySQL-compatible or MySQL-based','For horizontal scale. Compatibility is partial']]},
{p:'When a statement works in one product but not another, check the product and version first. Managed services also restrict some privileges and settings, covered in the last section.'}],
src:[['MySQL releases',K.D+'preface.html'],['What is new in MySQL 8.4',K.D+'mysql-nutshell.html']]};

/* ---------- 3 ---------- */
L['mysql:0:3']={blocks:[
{p:'Understanding the architecture explains almost everything later: why indexes matter, why transactions behave as they do, why some settings are per connection and others global. The server is built in layers, and the **storage engine** is a replaceable component at the bottom.'},
{svg:layers},
{h:'What each layer does'},
{t:[['Layer','Responsibility','Examples'],
['Connection','Accept connections, authenticate, assign a thread, check limits','Users, TLS, max_connections'],
['SQL','Parse text into a tree, check privileges, choose a plan, run it','Parser, optimizer, executor'],
['Storage engine','Store and retrieve rows, handle transactions and locking','InnoDB, MyISAM, MEMORY'],
['Files','Persist data and logs','.ibd files, redo log, binary log']]},
{h:'Life of a statement'},
{flow:['The client sends SQL text over a connection','The parser turns the text into a parse tree and checks syntax','The server checks that the user has privileges on the objects','The optimizer reads table statistics and picks an execution plan','The executor asks the storage engine for rows through the handler API','InnoDB reads pages from the buffer pool, going to disk on a miss','Results stream back to the client, and a change is written to the redo log and binary log']},
{h:'Two logs, two jobs'},
{p:'Beginners often confuse the two main logs. The **redo log** belongs to InnoDB and protects against crashes. The **binary log** belongs to the server layer and records changes for replication and point-in-time recovery. A committed change normally reaches both.'},
{note:'There is no query result cache in MySQL 8. It was removed in 8.0 because it did not scale. Caching belongs in the application or a cache layer.'}],
src:[['MySQL server architecture',K.D+'pluggable-storage-overview.html'],['InnoDB',K.INN]]};

/* ---------- 4 ---------- */
L['mysql:0:4']={blocks:[
{p:'The quickest way to get a safe practice server is a container. For a real host, use your operating system package manager or Oracle repository so that updates and the service definition come with it.'},
{h:'Option 1: Docker (best for learning)'},
{code:`docker run -d --name mysql84 \\
  -e MYSQL_ROOT_PASSWORD=ChangeMe-123 \\
  -p 3306:3306 \\
  -v mysql84data:/var/lib/mysql \\
  mysql:8.4

docker logs mysql84 | tail -3
docker exec -it mysql84 mysql -uroot -p`},
{p:'The named volume keeps the data when the container is replaced. Without it the data disappears with the container.'},
{h:'Option 2: Linux package'},
{code:`# Debian or Ubuntu, after adding the MySQL APT repository
sudo apt install mysql-server

# RHEL family, after adding the MySQL Yum repository
sudo dnf install mysql-community-server

sudo systemctl enable --now mysqld
sudo systemctl status mysqld`},
{p:'On RHEL family systems the first start generates a temporary root password in the error log. Read it, then set your own.'},
{code:`sudo grep 'temporary password' /var/log/mysqld.log
mysql -uroot -p
ALTER USER 'root'@'localhost' IDENTIFIED BY 'A-Long-Strong-Passphrase-1';`},
{h:'Option 3: Windows'},
{ul:['Use the **MySQL Installer**, choose Server only or Developer Default, and run the configuration wizard.','The server runs as a Windows service named MySQL84. Manage it from Services or with `net start` and `net stop`.','Data lives under `C:\\ProgramData\\MySQL` by default.']},
{h:'Secure the first start'},
{ul:['Set a strong root password and avoid using root for applications.','Keep the server bound to localhost until you need remote access (`bind-address`).','Run `mysql_secure_installation` on a host install to remove test items and review the basics.','Create one account per application with only the privileges it needs. Section 13 covers this.']},
{h:'Check it works'},
{code:`SELECT VERSION();
SHOW DATABASES;
SELECT @@port, @@datadir;`},
{note:'The commands for packages change between releases. Use the installation chapter of the manual for your platform and version.'}],
src:[['Installing MySQL',K.D+'installing.html'],['Deploying with Docker',K.D+'docker-mysql-getting-started.html']]};

/* ---------- 5 ---------- */
L['mysql:0:5']={blocks:[
{p:'You will use the command-line client constantly, so learn its habits early. Three tools talk to MySQL: the classic **mysql** client, **MySQL Shell** (`mysqlsh`) and **MySQL Workbench**.'},
{t:[['Tool','Type','Best for'],
['mysql','Command-line client','Quick statements, scripts, remote servers, always present'],
['mysqlsh','Command-line shell with SQL, JavaScript and Python modes','Admin tasks, InnoDB Cluster, dump and load utilities, upgrade checks'],
['MySQL Workbench','Desktop GUI','Visual modelling, query editing, browsing and admin screens'],
['Other GUIs','DBeaver, DataGrip, VS Code extensions','Day-to-day development']]},
{h:'Connecting'},
{code:`mysql -h 127.0.0.1 -P 3306 -u app -p appdb
mysql -u root -p -e "SELECT NOW()"
mysql -u app -p appdb < schema.sql`},
{p:'Use `-p` without the password so the client prompts for it. Putting a password on the command line exposes it in process lists and shell history.'},
{h:'Useful client commands'},
{t:[['Command','Purpose'],
['`USE appdb;`','Choose the default database for the session'],
['`SHOW DATABASES; SHOW TABLES;`','List objects'],
['`DESCRIBE orders;`','Show columns of a table'],
['`SHOW CREATE TABLE orders\\G`','Show the full definition. `\\G` prints rows vertically'],
['`source file.sql`','Run a script from inside the client'],
['`STATUS;`','Connection, version, character set and uptime'],
['`exit`','Leave the client']]},
{p:'Every statement ends with a semicolon, or with `\\G` for vertical output. A statement can span several lines.'},
{h:'MySQL Shell'},
{code:`mysqlsh root@localhost:3306
\\sql                      -- switch to SQL mode
SELECT 1;
\\js                       -- switch to JavaScript mode
util.checkForServerUpgrade()`},
{p:'Shell is where modern administration lives: building clusters with AdminAPI, parallel dump and load, and upgrade checks. You will use it in later sections.'},
{h:'Safer habits from day one'},
{ul:['Use a login path so credentials are stored obfuscated, not typed: `mysql_config_editor set --login-path=dev --host=localhost --user=app --password`.','Start the client with `--safe-updates` while learning, so an UPDATE or DELETE without a key condition is refused.','Check which database and server you are connected to before a destructive statement.']}],
src:[['mysql client',K.D+'mysql.html'],['MySQL Shell',K.SH]]};

/* ---------- 6 ---------- */
L['mysql:0:6']={blocks:[
{p:'A MySQL server reads settings from **option files** when it starts, and many settings can also be changed while it runs. Two questions guide every change: does it take effect now, and does it survive a restart?'},
{h:'Option files'},
{p:'The configuration file is usually `/etc/my.cnf` or `/etc/mysql/my.cnf` on Linux and `my.ini` on Windows. Settings live under group headers. The server reads `[mysqld]`, and the client reads `[client]` and `[mysql]`.'},
{code:`[mysqld]
port                 = 3306
bind-address         = 127.0.0.1
character-set-server = utf8mb4
innodb_buffer_pool_size = 4G
max_connections      = 300
slow_query_log       = ON
long_query_time      = 1

[client]
default-character-set = utf8mb4`},
{p:'Files are read in order, and later files override earlier ones. List what a server reads with `mysqld --verbose --help | head`, or see which options are active with `mysqld --print-defaults`.'},
{h:'Changing a variable at runtime'},
{t:[['Statement','Effect now','Survives restart'],
['`SET GLOBAL name = value`','Yes, for new connections','No'],
['`SET SESSION name = value`','Only this connection','No'],
['`SET PERSIST name = value`','Yes','Yes, written to mysqld-auto.cnf'],
['`SET PERSIST_ONLY name = value`','No, applies after restart','Yes. For static variables'],
['Edit my.cnf and restart','After restart','Yes']]},
{code:`SHOW VARIABLES LIKE 'max_connections';
SET PERSIST max_connections = 500;
SELECT * FROM performance_schema.persisted_variables;
RESET PERSIST max_connections;      -- remove the persisted value`},
{p:'Variables are **dynamic** (changeable while running) or **static** (restart needed). The manual lists which. SET PERSIST stores values in `mysqld-auto.cnf` in the data directory, read after the option files, so it can override them. Remember that file when a setting seems to ignore my.cnf.'},
{h:'Finding where a value comes from'},
{code:`SELECT variable_name, variable_source, variable_path
FROM performance_schema.variables_info
WHERE variable_name = 'max_connections';`},
{note:'Do not copy a tuned configuration from the internet. Section 12 explains the few settings that matter and how to size them.'}],
src:[['Option files',K.D+'option-files.html'],['SET PERSIST',K.D+'persisted-system-variables.html']]};

/* ---------- 7 ---------- */
L['mysql:0:7']={blocks:[
{p:'This guided session ties the foundations together. You create a database, a table, insert a few rows, read them back and clean up. Every concept here is explored properly in the next sections.'},
{h:'1. Create and select a database'},
{code:`CREATE DATABASE shop CHARACTER SET utf8mb4;
USE shop;`},
{h:'2. Create a table'},
{code:`CREATE TABLE customers (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email)
);`},
{p:'The **primary key** identifies each row. `AUTO_INCREMENT` generates the next id. The **unique key** stops two customers sharing an email.'},
{h:'3. Insert rows'},
{code:`INSERT INTO customers (name, email) VALUES
  ('Ana',  'ana@example.com'),
  ('Ben',  'ben@example.com'),
  ('Chen', 'chen@example.com');`},
{h:'4. Read them back'},
{code:`SELECT * FROM customers;
SELECT name FROM customers WHERE email LIKE 'b%';
SELECT COUNT(*) AS total FROM customers;`},
{h:'5. Change and remove'},
{code:`UPDATE customers SET name = 'Benjamin' WHERE id = 2;
DELETE FROM customers WHERE id = 3;
SELECT * FROM customers;`},
{h:'6. See the error a constraint gives'},
{code:`INSERT INTO customers (name, email) VALUES ('Dup', 'ana@example.com');
-- ERROR 1062 (23000): Duplicate entry 'ana@example.com' for key 'customers.uq_customers_email'`},
{h:'7. Clean up'},
{code:`DROP TABLE customers;
DROP DATABASE shop;`},
{note:'DROP is immediate and permanent. There is no recycle bin. On real systems you restore from a backup, which is why Section 14 matters.'},
{h:'What you used'},
{t:[['Statement family','Examples','Section'],
['DDL: define structure','CREATE, ALTER, DROP','2'],
['DML: change data','INSERT, UPDATE, DELETE','5'],
['Queries','SELECT with WHERE, COUNT','3 and 4']]}],
src:[['Tutorial',K.D+'tutorial.html'],['CREATE TABLE',K.D+'create-table.html']]};
})();
