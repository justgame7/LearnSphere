/* LearnSphere - Amazon Redshift, Section 03: Setup, Networking & Connectivity.
   Lectures 0-7 are core, 8-12 are additional content (flagged in index.html). Needs rs-common.js. */
(function(){
const R=window.RS,L=window.LESSONS,MG=R.MG,DG=R.DG;

/* ---------- diagrams ---------- */
const vpc=R.dg(700,300,[
[10,120,120,60,'Your client|laptop, BI tool, app',0],
[165,120,130,60,'Security group|allow TCP 5439|from known sources',2],
[330,10,360,280,'Your VPC',1],
[345,45,330,110,'Private subnets (subnet group or workgroup subnets)',1],
[360,75,300,65,'Redshift cluster or Serverless workgroup|endpoint, port 5439 by default',2],
[345,175,150,50,'S3 gateway endpoint|keeps COPY inside the VPC',0],[520,175,155,50,'NAT or internet gateway|only if you need it',0],
[345,240,330,40,'Public access: Redshift adds an Elastic IP; private is the default',0]],
[[130,150,165,150],[295,150,360,110]]);

const hybrid=R.dg(700,230,[
[10,70,130,80,'On-premises|network, BI servers,|ETL hosts',0],
[190,20,150,50,'Site-to-Site VPN|encrypted over internet',0],
[190,160,150,50,'Direct Connect|private dedicated link',0],
[390,60,130,100,'Virtual private gateway|or transit gateway',2],
[560,70,130,80,'Your VPC|private Redshift|endpoint',2]],
[[140,100,190,50],[140,125,190,180],[340,45,390,90],[340,185,390,135],[520,110,560,110]]);

/* ================= LECTURE 0 ================= */
L['rs:2:0']={blocks:[
{p:'Before you create a warehouse you need an AWS account, a safe way to sign in, a Region to work in and an IAM role that lets Redshift reach Amazon S3. Setting these up properly now avoids most beginner problems later.'},
{h:'1. Account and sign-in'},
{ul:['Create an AWS account and **do not use the root user** for daily work. Create an administrative IAM user or sign in through IAM Identity Center.','Turn on multi-factor authentication for the root user and for any administrator.','Set the **budget alert** described in Section 1 before creating anything.']},
{h:'2. Choose a Region'},
{t:[['Factor','Why it matters'],
['Where your data is','Keep the warehouse in the same Region as the S3 buckets you load from. Redshift Spectrum requires the S3 data to be in the same Region as the cluster'],
['Where your users are','Latency and data residency rules'],
['Feature availability','Not every feature or node type exists in every Region, for example 4 RPU Serverless and query editor v2 are limited to certain Regions'],
['Price','Prices differ by Region']]},
{h:'3. Two kinds of IAM permission'},
{t:[['Who','Needs permission to','Typical way'],
['**You, the administrator**','Create and manage clusters, workgroups, snapshots and networking','An IAM user or role with the AWS managed policy `AmazonRedshiftFullAccess` plus access to the VPC resources you use'],
['**Redshift itself**','Read from S3 for `COPY`, write to S3 for `UNLOAD`, query the data lake','An **IAM role** that Redshift assumes, attached to the cluster or namespace']]},
{h:'4. Create the role Redshift assumes'},
{p:'The role needs a trust policy that lets the Redshift service assume it, and a permissions policy for S3. For labs the read-only managed policy is enough; in production grant access only to the buckets you load from.'},
{code:`# trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "redshift.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}

aws iam create-role --role-name MyRedshiftRole \\
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy --role-name MyRedshiftRole \\
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess`},
{p:'You attach the role to a provisioned cluster with `--iam-roles` at creation (next lecture) or to a Serverless namespace. In the console you can also create the role and mark it as the **default** role so `COPY` can use `IAM_ROLE default`.'},
{note:'A cluster can have up to 50 IAM roles associated with it. Prefer one narrowly scoped role per purpose over one all-powerful role.'},
{h:'Checklist'},
{ul:['Admin user with MFA, not root.','Budget alert created.','Region chosen and noted.','IAM role for S3 created and its ARN saved.','A VPC with subnets in more than one Availability Zone (the default VPC works for labs; Serverless needs three subnets in three AZs).']}],
src:[['Identity and access management in Amazon Redshift',MG+'redshift-iam-authentication-access-control.html'],['Authorizing COPY and UNLOAD operations using IAM roles',MG+'copy-unload-iam-role.html'],['Quotas and limits',MG+'amazon-redshift-limits.html']]};

/* ================= LECTURE 1 ================= */
L['rs:2:1']={blocks:[
{p:'This lecture creates a **provisioned cluster**, first by understanding every choice and then with the AWS CLI. It applies to Provisioned only. Remember to delete the cluster when you finish (see the clean-up lecture).'},
{h:'What you decide'},
{t:[['Setting','Notes'],
['Cluster identifier','Lowercase, 1 to 63 letters, digits or hyphens, starts with a letter, no trailing or double hyphen, unique in the account'],
['Node type and count','Choose RG or RA3. The console **Help me choose** calculator recommends a size from your data and queries. A two-node ra3.xlplus is a common small lab size'],
['Database name','Default `dev`'],
['Admin user and password','Admin user: lowercase, 1 to 128 characters, starts with a letter, not a reserved word. Password: 8 to 64 characters with an upper case letter, a lower case letter and a number; it cannot contain a single quote, double quote, backslash, slash or at sign'],
['Network','A cluster **subnet group** (the subnets Redshift may use), one or more **security groups**, and whether the cluster is publicly accessible. Private is the default'],
['IAM roles','Roles Redshift assumes to reach S3 and other services'],
['Parameter group','Defaults to the default group; use a custom group to change settings (Section 4)'],
['Port','5439 by default']]},
{h:'Create it with the AWS CLI'},
{code:`# 1. A subnet group from subnets in at least two Availability Zones
aws redshift create-cluster-subnet-group \\
  --cluster-subnet-group-name lab-subnets \\
  --description "Lab subnets" \\
  --subnet-ids subnet-aaaa1111 subnet-bbbb2222

# 2. The cluster. --manage-master-password lets Redshift keep the admin
#    password in AWS Secrets Manager so it never appears in your scripts
aws redshift create-cluster \\
  --cluster-identifier lab-cluster \\
  --node-type ra3.xlplus --number-of-nodes 2 \\
  --db-name dev \\
  --master-username awsuser --manage-master-password \\
  --cluster-subnet-group-name lab-subnets \\
  --vpc-security-group-ids sg-0123456789abcdef0 \\
  --iam-roles arn:aws:iam::123456789012:role/MyRedshiftRole \\
  --no-publicly-accessible \\
  --tags Key=project,Value=learnsphere-lab

# 3. Wait for it and read the endpoint
aws redshift wait cluster-available --cluster-identifier lab-cluster
aws redshift describe-clusters --cluster-identifier lab-cluster \\
  --query "Clusters[0].[ClusterStatus,Endpoint.Address,Endpoint.Port]" --output text`},
{p:'Creation takes a few minutes. The status moves from `creating` to `available`; the endpoint address is what you connect to.'},
{h:'Verify'},
{ul:['`ClusterStatus` is `available`.','The endpoint looks like `lab-cluster.xxxxxxxx.region.redshift.amazonaws.com` and the port is `5439`.','You can connect and run `SELECT version();` (see the connection lectures).']},
{note:'A single-node cluster shares one node between leader and compute work and is not recommended for production. Use at least two nodes for anything you care about.'},
{h:'Common creation errors'},
{t:[['Symptom','Likely cause'],
['Subnet group or VPC error','Subnets are not in the VPC you expect, or fewer than the required Availability Zones'],
['Invalid password or user','Password or admin name breaks the naming rules above'],
['Quota exceeded','Account node, cluster or parameter group limit reached (see Quotas in Section 4)'],
['Cannot connect after creation','Security group does not allow port 5439 from your address, or the cluster is private and you are outside the VPC']]}],
src:[['Creating a cluster',MG+'create-cluster.html'],['Amazon Redshift provisioned clusters',MG+'working-with-clusters.html'],['Quotas and limits (naming constraints)',MG+'amazon-redshift-limits.html']]};

/* ================= LECTURE 2 ================= */
L['rs:2:2']={blocks:[
{p:'This lecture creates a **Serverless** warehouse. You create a **namespace** (the data side) and a **workgroup** (the compute side) and pair them. It applies to Serverless only.'},
{h:'Requirements'},
{ul:['An Amazon VPC with **three subnets in three different Availability Zones** and at least three free IP addresses.','An IAM role for S3 access if you plan to load data (previous lecture).','For the fastest start, the console option **Use default settings** creates a namespace called `default-namespace` and a workgroup called `default`.']},
{h:'What you decide'},
{t:[['Where','Setting','Notes'],
['Namespace','Database name, admin user, KMS key, IAM roles','Default database `dev`; data is encrypted with a KMS key (default key unless you choose another)'],
['Workgroup','Base capacity in RPUs','Default 128 RPUs; allowed 4 to 512 (up to 1024 in some Regions). Use a small value such as 8 for labs'],
['Workgroup','Subnets and security groups','The network the workgroup lives in'],
['Workgroup','Publicly accessible','Off unless you need to connect from outside the VPC'],
['Workgroup','Port','5439 by default; can be changed to 5431 to 5455 or 8191 to 8215 with `update-workgroup`']]},
{h:'Create it with the AWS CLI'},
{code:`# 1. Namespace: databases, users, encryption, IAM roles
aws redshift-serverless create-namespace \\
  --namespace-name lab-ns \\
  --db-name dev \\
  --admin-username awsuser --manage-admin-password \\
  --iam-roles arn:aws:iam::123456789012:role/MyRedshiftRole

# 2. Workgroup: compute and network, paired with the namespace
aws redshift-serverless create-workgroup \\
  --workgroup-name lab-wg \\
  --namespace-name lab-ns \\
  --base-capacity 8 \\
  --subnet-ids subnet-aaaa1111 subnet-bbbb2222 subnet-cccc3333 \\
  --security-group-ids sg-0123456789abcdef0 \\
  --no-publicly-accessible

# 3. Check status and read the endpoint
aws redshift-serverless get-workgroup --workgroup-name lab-wg \\
  --query "workgroup.[status,endpoint.address,endpoint.port]" --output text`},
{p:'When the workgroup status is `AVAILABLE` you can connect. The endpoint format is `workgroup-name.account-number.aws-region.redshift-serverless.amazonaws.com:port/dev`.'},
{h:'Cap spending from day one'},
{code:`# Limit how far capacity can scale, and log if a daily budget is exceeded
aws redshift-serverless update-workgroup --workgroup-name lab-wg --max-capacity 32

aws redshift-serverless create-usage-limit \\
  --resource-arn <workgroup-arn> --usage-type serverless-compute \\
  --amount 100 --period daily --breach-action log`},
{h:'Clean-up order'},
{p:'Delete the **workgroup first**, then the namespace. Deleting a namespace takes several minutes. If the workgroup fails to create, fix the reported error (often too few subnets) and delete the half-created namespace before retrying.'},
{code:`aws redshift-serverless delete-workgroup --workgroup-name lab-wg
aws redshift-serverless delete-namespace --namespace-name lab-ns`},
{note:'Serverless does not bill compute while idle, but storage and any snapshots still cost money until you delete them.'}],
src:[['Workgroups and namespaces',MG+'serverless-workgroup-namespace.html'],['Get started with Redshift Serverless',R.D+'gsg/new-user-serverless.html'],['Compute capacity for Serverless',MG+'serverless-capacity.html']]};

/* ================= LECTURE 3 ================= */
L['rs:2:3']={blocks:[
{p:'Redshift lives inside your VPC, so networking decides who can reach it. Most connection problems are network problems, so learn the pieces once.'},
{svg:vpc},
{h:'The building blocks'},
{t:[['Piece','Provisioned','Serverless'],
['Where it runs','In a VPC; dedicated-tenancy VPCs are not supported','In a VPC'],
['Which subnets','You create a **cluster subnet group** and name it when creating the cluster','You assign subnets **directly to the workgroup**; no subnet group'],
['Firewall','VPC **security groups** attached to the cluster','VPC security groups attached to the workgroup'],
['Port','5439 by default','5439 by default; ranges 5431 to 5455 and 8191 to 8215 allowed'],
['Reachability','Private by default; optionally publicly accessible','Private by default; optionally publicly accessible']]},
{h:'Private vs public access'},
{ul:['**Private (default)**: the endpoint resolves to addresses inside your VPC. You reach it from the same VPC, a peered or connected network, a VPN or Direct Connect, or a Redshift-managed VPC endpoint.','**Public**: Redshift uses an **Elastic IP address** as the external address, so clients on the internet can connect if the security group and subnet routing allow it. Use this only when you must, and restrict the source addresses.','For a publicly accessible provisioned cluster, turn on **DNS resolution** and **DNS hostnames** in the VPC so clients inside the VPC resolve the private IP instead of the Elastic IP. Serverless cannot be reached through its private IP this way.']},
{h:'Open the port, narrowly'},
{code:`# Allow your own address (and nothing else) to reach port 5439
aws ec2 authorize-security-group-ingress \\
  --group-id sg-0123456789abcdef0 \\
  --protocol tcp --port 5439 \\
  --cidr 203.0.113.25/32`},
{note:'Never open port 5439 to 0.0.0.0/0. Anyone who finds the endpoint can then attempt to log in. Prefer a security group rule that references another security group, such as your application servers.'},
{h:'How a connection reaches the warehouse'},
{flow:['Client resolves the endpoint name','Traffic reaches the VPC','Security group checks port and source','Subnet routing delivers it','Leader node accepts the login']},
{h:'Other things to know'},
{ul:['A snapshot of a cluster or workgroup in a VPC can be restored only into a VPC, the same one or another in your account.','Provisioned clusters show public and private **node IP addresses** in the console. These matter only for rules on remote hosts when loading over SSH. They do not apply to Serverless.','Redshift-managed VPC endpoints and PrivateLink let other VPCs and accounts connect privately (see the additional lecture).']}],
src:[['Redshift resources in a VPC',MG+'managing-clusters-vpc.html'],['Connecting to Amazon Redshift Serverless',MG+'serverless-connecting.html'],['Security groups for Redshift',MG+'rs-security-group-public-private.html']]};

/* ================= LECTURE 4 ================= */
L['rs:2:4']={blocks:[
{p:'There are two quick ways to run your first query: the browser-based **query editor v2** and the command-line client **psql**.'},
{h:'Query editor v2'},
{p:'Query editor v2 is a separate web-based SQL client in the AWS console. You use it to write and run queries, visualize results, share work with a team, and create databases, schemas, tables and functions. A tree view shows each database, its schemas, and for each schema its tables, views, UDFs and stored procedures.'},
{ul:['Open it from the Redshift console (for Serverless the **Query data** button opens it in a new tab) and choose your cluster or workgroup in the tree.','The first time you connect you pick how to authenticate, for example the federated user from your AWS sign-in, temporary credentials, or a database user name and password.','**Notebooks** hold SQL and Markdown cells so you can document and share a sequence of queries.','On Serverless it can load sample data from the `sample_data_dev` database, which holds three sample datasets.','It can load a character-separated local file smaller than 5 MB, and fetches at most 100 MB per query.','By default each user can hold 3 database connections; an administrator can change this from 1 to 10.']},
{h:'psql'},
{p:'`psql` is the PostgreSQL command-line client. It works with Redshift because Redshift speaks the PostgreSQL protocol. From a machine that can reach your endpoint:'},
{code:`# Provisioned
psql -h lab-cluster.xxxxxxxx.us-east-1.redshift.amazonaws.com -p 5439 -U awsuser -d dev

# Serverless
psql -h lab-wg.123456789012.us-east-1.redshift-serverless.amazonaws.com -p 5439 -U awsuser -d dev

# Require an encrypted connection explicitly
psql "host=<endpoint> port=5439 dbname=dev user=awsuser sslmode=require"`},
{note:'The default for the require_ssl parameter has been true since January 10, 2025, so new warehouses reject unencrypted connections. Always connect with SSL.'},
{h:'Your first queries'},
{code:`SELECT version();
SELECT current_database(), current_user, current_schema();
SELECT 1 + 1 AS two;
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema') LIMIT 10;`},
{p:'Some `psql` meta-commands such as `\\d` rely on PostgreSQL catalog features that Redshift does not fully provide. If the output looks wrong, query the `SVV_` views instead (Section 5).'},
{h:'Troubleshooting a first connection'},
{t:[['Symptom','Check'],
['Timeout','Security group rule for port 5439, route from your network, private vs public setting'],
['Could not resolve host','Endpoint spelled correctly; inside the VPC DNS settings for private access'],
['Password authentication failed','User name and password; admin password stored in Secrets Manager if you used a managed password'],
['SSL error','Connect with SSL; supply the Amazon trust CA bundle if you verify the certificate']]}],
src:[['Querying a database using the query editor v2',MG+'query-editor-v2.html'],['Quotas and limits',MG+'amazon-redshift-limits.html'],['Amazon Redshift parameter groups',MG+'working-with-parameter-groups.html']]};

/* ================= LECTURE 5 ================= */
L['rs:2:5']={blocks:[
{p:'Applications talk to Redshift through a driver. Choose the Redshift drivers, not the generic PostgreSQL ones, and prefer short-lived credentials over stored passwords.'},
{h:'Use the Redshift drivers'},
{p:'Amazon Redshift provides **JDBC**, **ODBC** and **Python** drivers and supports them. PostgreSQL drivers are not tested or supported by the Redshift team. The Redshift drivers add support for IAM, single sign-on and federated authentication, new Redshift data types, authentication profiles and performance improvements.'},
{h:'Connection strings'},
{t:[['Driver','Example'],
['JDBC (password)','`jdbc:redshift://lab-cluster.xxxxxxxx.us-east-1.redshift.amazonaws.com:5439/dev`'],
['JDBC (IAM)','`jdbc:redshift:iam://lab-cluster.xxxxxxxx.us-east-1.redshift.amazonaws.com:5439/dev`'],
['JDBC Serverless','`jdbc:redshift://lab-wg.123456789012.us-east-1.redshift-serverless.amazonaws.com:5439/dev`'],
['ODBC Serverless','`Driver={Amazon Redshift (x64)}; Server=lab-wg.123456789012.us-east-1.redshift-serverless.amazonaws.com; Database=dev`']]},
{p:'The console shows the exact JDBC and ODBC strings for your warehouse on its detail page.'},
{h:'Python connector'},
{code:`import redshift_connector

# Password authentication (read the secret from Secrets Manager, never hard-code it)
conn = redshift_connector.connect(
    host="lab-cluster.xxxxxxxx.us-east-1.redshift.amazonaws.com",
    port=5439, database="dev",
    user="awsuser", password=get_password_from_secrets_manager(),
)

# IAM authentication: temporary credentials, no stored password
conn = redshift_connector.connect(
    iam=True, cluster_identifier="lab-cluster", region="us-east-1",
    database="dev", db_user="awsuser", profile="default",
)

cur = conn.cursor()
cur.execute("SELECT current_user, version()")
print(cur.fetchone())`},
{h:'Choosing how to authenticate'},
{t:[['Method','Credentials','Best for'],
['Database user and password','Stored password','Quick labs; avoid in production code'],
['AWS Secrets Manager','Redshift or your code reads a secret holding user name and password; rotation possible','Applications that need a fixed database user'],
['IAM temporary credentials','Short-lived password issued for an IAM identity','Applications and people on AWS; no stored password'],
['Federated or IAM Identity Center','Corporate identity provider','Human users through BI tools']]},
{h:'SSL and certificates'},
{p:'Connect over SSL. If your client verifies the server certificate (`sslmode` of `verify-ca` or `verify-full`), give it the Amazon Trust CA bundle (`amazon-trust-ca-bundle.crt`). Do not use the older `redshift-ca-bundle.crt`.'},
{note:'For SUPER columns use JDBC 2.x, ODBC 2.x or the Python driver version 2.0.872 or later.'}],
src:[['Configuring connections in Amazon Redshift',MG+'configuring-connections.html'],['Connecting to Amazon Redshift Serverless',MG+'serverless-connecting.html'],['Amazon Redshift Python connector',MG+'python-redshift-driver.html']]};

/* ================= LECTURE 6 ================= */
L['rs:2:6']={blocks:[
{p:'The **Redshift Data API** runs SQL over HTTPS. You do not install drivers, open persistent connections, manage credentials in your code or configure network access to the database. It works for provisioned clusters and Serverless workgroups.'},
{h:'How it works'},
{flow:['Call ExecuteStatement with SQL','Receive a statement Id immediately','Poll DescribeStatement until FINISHED','Call GetStatementResult to read rows']},
{ul:['Calls are **asynchronous**: ExecuteStatement returns an Id straight away and the SQL runs in the background.','You authenticate with the AWS SDK (IAM); you do not pass a database password.','It suits Lambda functions, notebooks, scripts and any place a driver is awkward.']},
{h:'Choosing database credentials'},
{t:[['Method','You supply','Notes'],
['Secrets Manager','`secret-arn` plus database','The secret holds the database user name and password'],
['Temporary credentials (Serverless)','Workgroup name and database','Database user is derived from your IAM identity, for example `IAM:foo`; needs `redshift-serverless:GetCredentials`'],
['Temporary credentials (cluster)','Cluster identifier, database, optionally a database user','Needs `redshift:GetClusterCredentials` or `GetClusterCredentialsWithIAM`'],
['IAM Identity Center','A signed-in single sign-on user','Uses trusted identity propagation']]},
{h:'Try it with the AWS CLI'},
{code:`# Serverless, using temporary credentials from your IAM identity
aws redshift-data execute-statement \\
  --workgroup-name lab-wg --database dev \\
  --sql "SELECT current_user, version()"
# -> returns "Id": "<statement-id>"

aws redshift-data describe-statement --id <statement-id>
# -> Status: SUBMITTED, PICKED, STARTED, FINISHED, FAILED or ABORTED

aws redshift-data get-statement-result --id <statement-id>

# Provisioned: use the cluster and a secret instead
aws redshift-data execute-statement \\
  --cluster-identifier lab-cluster --database dev \\
  --secret-arn <secret-arn> --sql "SELECT 1"`},
{h:'The same in Python'},
{code:`import boto3, time
rd = boto3.client("redshift-data")

r = rd.execute_statement(WorkgroupName="lab-wg", Database="dev",
                         Sql="SELECT :n AS n",
                         Parameters=[{"name": "n", "value": "42"}])
sid = r["Id"]
while rd.describe_statement(Id=sid)["Status"] not in ("FINISHED", "FAILED", "ABORTED"):
    time.sleep(1)
print(rd.get_statement_result(Id=sid)["Records"])`},
{h:'Limits to remember'},
{t:[['Limit','Value'],
['Maximum query duration','24 hours'],
['Active queries per cluster','500 (STARTED and SUBMITTED)'],
['Maximum result size','500 MB after gzip compression'],
['Result retention','24 hours'],
['Maximum statement size','200 KB'],
['Cluster requirement','Must be in a VPC']]},
{note:'Named parameters (:name) replace values only. You cannot parameterize column or table names, and you cannot pass SQL NULL or an empty string. Use parameters instead of string concatenation to avoid SQL injection.'}],
src:[['Using the Amazon Redshift Data API',MG+'data-api.html'],['Data API quotas',MG+'amazon-redshift-limits.html'],['Data API Reference','https://docs.aws.amazon.com/redshift-data/latest/APIReference/Welcome.html']]};

/* ================= LECTURE 7 ================= */
L['rs:2:7']={blocks:[
{p:'Now that you can connect, load a small sample dataset, run real queries and, most important, clean up. The sample is the **TICKIT** database, a ticket-selling model used throughout the AWS documentation.'},
{h:'Option A (Serverless): built-in sample data'},
{p:'In query editor v2 connect to your workgroup, expand the `sample_data_dev` database, choose a sample dataset and choose **Open sample notebooks**. The first time, you are asked to create the sample database. Choose **Create**, then **Run all** to run the sample queries.'},
{h:'Option B (any warehouse): load TICKIT from Amazon S3'},
{p:'This needs the default IAM role from the prerequisites lecture. The files are in a public AWS bucket in `us-east-1`.'},
{code:`create table users(
  userid integer not null distkey sortkey,
  username char(8), firstname varchar(30), lastname varchar(30),
  city varchar(30), state char(2), email varchar(100), phone char(14),
  likesports boolean, liketheatre boolean, likeconcerts boolean, likejazz boolean,
  likeclassical boolean, likeopera boolean, likerock boolean, likevegas boolean,
  likebroadway boolean, likemusicals boolean);

create table event(
  eventid integer not null distkey, venueid smallint not null,
  catid smallint not null, dateid smallint not null sortkey,
  eventname varchar(200), starttime timestamp);

create table sales(
  salesid integer not null, listid integer not null distkey,
  sellerid integer not null, buyerid integer not null,
  eventid integer not null, dateid smallint not null sortkey,
  qtysold smallint not null, pricepaid decimal(8,2),
  commission decimal(8,2), saletime timestamp);

COPY users FROM 's3://redshift-downloads/tickit/allusers_pipe.txt'
  DELIMITER '|' TIMEFORMAT 'YYYY-MM-DD HH:MI:SS' IGNOREHEADER 1
  REGION 'us-east-1' IAM_ROLE default;
COPY event FROM 's3://redshift-downloads/tickit/allevents_pipe.txt'
  DELIMITER '|' TIMEFORMAT 'YYYY-MM-DD HH:MI:SS' IGNOREHEADER 1
  REGION 'us-east-1' IAM_ROLE default;
COPY sales FROM 's3://redshift-downloads/tickit/sales_tab.txt'
  DELIMITER '\\t' TIMEFORMAT 'MM/DD/YYYY HH:MI:SS' IGNOREHEADER 1
  REGION 'us-east-1' IAM_ROLE default;`},
{p:'Notice the `distkey` and `sortkey` keywords in the table definitions. You will learn what they do in Section 6.'},
{h:'First queries'},
{code:`-- Top 10 buyers by quantity
SELECT firstname, lastname, total_quantity
FROM (SELECT buyerid, SUM(qtysold) total_quantity
      FROM sales GROUP BY buyerid ORDER BY total_quantity DESC LIMIT 10) q, users
WHERE q.buyerid = userid
ORDER BY q.total_quantity DESC;

-- How big are the tables? (size is in 1 MB blocks)
SELECT "table", size, tbl_rows FROM svv_table_info ORDER BY size DESC;`},
{h:'Clean up so the lab stops billing'},
{t:[['Resource','Action'],
['Provisioned cluster','`aws redshift pause-cluster` to keep it, or `delete-cluster` when finished'],
['Serverless workgroup and namespace','Delete the workgroup, then the namespace; idle Serverless does not bill compute but storage remains'],
['Snapshots','Delete manual snapshots you no longer need; they are billed'],
['IAM role and secret','Delete if the lab is over'],
['S3 data you uploaded','Delete test files and buckets']]},
{code:`aws redshift delete-cluster --cluster-identifier lab-cluster --skip-final-cluster-snapshot
aws redshift-serverless delete-workgroup --workgroup-name lab-wg
aws redshift-serverless delete-namespace --namespace-name lab-ns`},
{note:'--skip-final-cluster-snapshot discards the data permanently. That is correct for a throwaway lab and wrong for anything you need. Check the billing console the next day to confirm nothing is still running.'}],
src:[['Get started with Redshift Serverless (sample data)',R.D+'gsg/new-user-serverless.html'],['Sample database',DG+'c_sampledb.html'],['COPY',DG+'r_COPY.html']]};

/* ================= ADDITIONAL 8 ================= */
L['rs:2:8']={blocks:[
{p:'By default Redshift sends `COPY` and `UNLOAD` traffic over routes that may leave your VPC and cross the public internet. **Enhanced VPC routing** forces that traffic through your VPC so you control it with normal VPC tools.'},
{h:'What enhanced VPC routing does'},
{ul:['Forces all `COPY` and `UNLOAD` traffic between the warehouse and your data repositories through your VPC.','Lets you apply security groups, network ACLs, VPC endpoints and endpoint policies, internet gateways and DNS, and monitor the traffic with VPC flow logs.','Works for both provisioned clusters and Serverless workgroups. There is no extra charge for the feature, although some data transfer can cost money, for example `UNLOAD` to S3 in another Region.','If it is off, traffic is routed over the internet, including traffic to other AWS services.']},
{note:'Turning it on can make COPY and UNLOAD fail until the VPC has a network path to your data. Plan the endpoints first, then enable it.'},
{h:'Network paths to provide'},
{t:[['Destination','Path'],
['S3 bucket in the same Region','A **VPC endpoint** for S3 (gateway endpoint). You can attach an endpoint policy'],
['S3 in another Region, other AWS services, hosts outside AWS','A **NAT gateway**'],
['AWS services outside the VPC','An **internet gateway**; the warehouse must then be publicly accessible'],
['IAM Identity Center sign-in','Interface VPC endpoints for those services, or sign-in fails']]},
{code:`# 1. S3 gateway endpoint for the VPC
aws ec2 create-vpc-endpoint --vpc-id vpc-0123456789abcdef0 \\
  --service-name com.amazonaws.us-east-1.s3 \\
  --route-table-ids rtb-0123456789abcdef0

# 2. Turn it on
aws redshift modify-cluster --cluster-identifier lab-cluster --enhanced-vpc-routing
aws redshift-serverless update-workgroup --workgroup-name lab-wg --enhanced-vpc-routing`},
{p:'Redshift Spectrum has its own requirements when enhanced VPC routing is on; follow the dedicated Management Guide topic for querying data lake tables with enhanced VPC routing.'},
{h:'Reaching Redshift privately from other networks'},
{ul:['**Redshift-managed VPC endpoints**: let a client in another VPC, or another account, connect privately. A cluster can have up to 30 of them by default.','**Interface VPC endpoints (AWS PrivateLink)** for the Redshift service API.','**Cross-account Serverless access**: the owner grants access with a resource policy (`put-resource-policy`) and the grantee creates an endpoint with `create-endpoint-authorization`, so users do not need to exist in the owning account.','A **custom domain name** can replace the long endpoint name for clients.']}],
src:[['Controlling network traffic with enhanced VPC routing',MG+'enhanced-vpc-routing.html'],['Redshift-managed VPC endpoints',MG+'managing-cluster-cross-vpc.html'],['Connecting to Redshift Serverless',MG+'serverless-connecting.html']]};

/* ================= ADDITIONAL 9 ================= */
L['rs:2:9']={blocks:[
{p:'Clicking in the console is fine for learning, but real warehouses should be created from code so they are repeatable, reviewable and easy to rebuild. This lecture shows the main resources in CloudFormation and Terraform.'},
{h:'Why infrastructure as code'},
{ul:['The same definition builds dev, test and production.','Changes go through review and are recorded in version control.','You can rebuild after a mistake or disaster, and delete lab environments cleanly.']},
{h:'Resources you will use'},
{t:[['What','CloudFormation','Terraform'],
['Provisioned cluster','`AWS::Redshift::Cluster`','`aws_redshift_cluster`'],
['Subnet group','`AWS::Redshift::ClusterSubnetGroup`','`aws_redshift_subnet_group`'],
['Parameter group','`AWS::Redshift::ClusterParameterGroup`','`aws_redshift_parameter_group`'],
['Serverless namespace','`AWS::RedshiftServerless::Namespace`','`aws_redshiftserverless_namespace`'],
['Serverless workgroup','`AWS::RedshiftServerless::Workgroup`','`aws_redshiftserverless_workgroup`']]},
{h:'CloudFormation: a Serverless warehouse'},
{code:`AWSTemplateFormatVersion: "2010-09-09"
Resources:
  Namespace:
    Type: AWS::RedshiftServerless::Namespace
    Properties:
      NamespaceName: lab-ns
      DbName: dev
      AdminUsername: awsuser
      ManageAdminPassword: true      # password kept in Secrets Manager
  Workgroup:
    Type: AWS::RedshiftServerless::Workgroup
    Properties:
      WorkgroupName: lab-wg
      NamespaceName: !Ref Namespace
      BaseCapacity: 8
      SubnetIds: [subnet-aaaa1111, subnet-bbbb2222, subnet-cccc3333]
      SecurityGroupIds: [sg-0123456789abcdef0]
      PubliclyAccessible: false`},
{h:'Terraform: a provisioned cluster'},
{code:`resource "aws_redshift_cluster" "lab" {
  cluster_identifier        = "lab-cluster"
  node_type                 = "ra3.xlplus"
  number_of_nodes           = 2
  database_name             = "dev"
  master_username           = "awsuser"
  manage_master_password    = true      # no password in code or state
  cluster_subnet_group_name = aws_redshift_subnet_group.lab.name
  vpc_security_group_ids    = [aws_security_group.redshift.id]
  publicly_accessible       = false
  skip_final_snapshot       = true      # lab only
  tags = { project = "learnsphere-lab" }
}`},
{h:'Good habits'},
{ul:['Choose a **current node type** (RG or RA3). Do not start new templates on DC2.','Never put passwords in templates or variable files. Use managed passwords or Secrets Manager references.','Tag every resource for cost tracking.','Set `skip_final_snapshot` to false and name a final snapshot for anything that holds real data.','Keep parameter groups in code so settings like `require_ssl` are visible and reviewed.','Run a plan or change set before every apply; a node-type or capacity change can trigger a resize.']}],
src:[['AWS::Redshift::Cluster (CloudFormation)','https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-redshift-cluster.html'],['AWS::RedshiftServerless::Workgroup (CloudFormation)','https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-redshiftserverless-workgroup.html'],['Terraform AWS provider: aws_redshift_cluster','https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/redshift_cluster']]};

/* ================= ADDITIONAL 10 ================= */
L['rs:2:10']={blocks:[
{p:'Beyond the basics, the Data API supports sessions, batches, long polling and idempotency. These features matter when you call Redshift from Lambda and Step Functions.'},
{h:'Sessions: reuse a connection'},
{p:'Normally the session ends when a statement finishes. Set `SessionKeepAliveSeconds` to keep it open so the next statement can reuse temporary tables and session settings. The response contains a `SessionId` to pass to later calls.'},
{ul:['Maximum keep-alive is 24 hours, and a session lives at most 24 hours.','Up to 500 sessions per cluster or workgroup.','One query at a time per session. The Data API does not queue queries inside a session.','`ListSessions` shows sessions and their status.']},
{code:`aws redshift-data execute-statement --workgroup-name lab-wg --database dev \\
  --session-keep-alive-seconds 60 --sql "CREATE TEMP TABLE t AS SELECT 1 AS x"
# response includes SessionId

aws redshift-data execute-statement --session-id <session-id> --sql "SELECT * FROM t"`},
{h:'Batches'},
{p:'`BatchExecuteStatement` runs several statements serially in the order given. By default all run as **one transaction**: if any fails, everything rolls back. Set `ExecutionMode` to `AUTO_COMMIT` to commit each statement on its own.'},
{code:`aws redshift-data batch-execute-statement --workgroup-name lab-wg --database dev \\
  --sqls "INSERT INTO audit VALUES (1)" "UPDATE stats SET n = n + 1"`},
{h:'Long polling'},
{p:'`WaitTimeSeconds` makes the Data API wait up to 30 seconds when you submit a statement or check one in progress, which reduces the number of poll requests and lowers latency.'},
{h:'Idempotency and retries'},
{ul:['`ClientToken` makes an ExecuteStatement or BatchExecuteStatement safe to retry; it expires after 8 hours.','AWS SDKs add a token automatically on retry, so do not set one yourself there.','**Step Functions does not retry by default.** If you call the Data API from a state machine, pass a `ClientToken` that stays the same across retries, for example the execution Id.','Throttling returns `ThrottlingException` (HTTP 400). Retry with backoff.']},
{t:[['API','Default limit (requests per second)'],
['ExecuteStatement','30'],['BatchExecuteStatement','20'],['DescribeStatement','100'],['GetStatementResult','20'],['CancelStatement','3']]},
{h:'Results and formats'},
{ul:['Default result format is JSON, read with `GetStatementResult`.','Choose CSV and read with `GetStatementResultV2`: results come in 1 MB chunks, up to 15 MB per request, with a token for the next page.','Statements are visible to other callers who can assume the same IAM role as the caller.']},
{h:'Calling it from Lambda'},
{code:`import boto3
rd = boto3.client("redshift-data")

def handler(event, context):
    r = rd.execute_statement(
        WorkgroupName="lab-wg", Database="dev",
        Sql="CALL load_daily_sales(:d)",
        Parameters=[{"name": "d", "value": event["date"]}],
        WithEvent=True)               # emit an EventBridge event when it finishes
    return {"statementId": r["Id"]}`},
{note:'WithEvent lets EventBridge trigger the next step when the statement finishes, so your Lambda does not have to wait or poll.'}],
src:[['Using the Amazon Redshift Data API',MG+'data-api.html'],['Data API quotas',MG+'amazon-redshift-limits.html']]};

/* ================= ADDITIONAL 11 ================= */
L['rs:2:11']={blocks:[
{p:'A warehouse is not built for thousands of tiny connections. Understanding connection limits, timeouts and result-set handling prevents the most common production surprises.'},
{h:'Limits and timeouts'},
{t:[['Limit','Provisioned','Serverless'],
['Maximum connections','2,000 for RA3 and RG (hard limit); dc2.large 500','2,000 per workgroup'],
['Idle session timeout','4 hours (cluster); a user setting from ALTER USER takes precedence','1 hour'],
['Idle transaction timeout','6 hours','6 hours'],
['Longest running query','Controlled by `statement_timeout`; default 0 means no limit','24 hours (86,399 seconds)']]},
{h:'Pooling'},
{ul:['Use a **connection pool** with a modest size. More connections do not make queries faster; the number of queries that run at once is controlled by workload management (Section 9) and extra queries wait.','Close connections in your application so they are not left idle until the timeout.','Free connections in an emergency by ending idle sessions: `SELECT pg_terminate_backend(pid)`.','For bursts of short, independent statements from serverless code, prefer the **Data API** over opening many connections.']},
{h:'Large result sets'},
{p:'A warehouse query can return millions of rows. Pulling them all into client memory is the usual cause of out-of-memory errors.'},
{ul:['Use a **cursor** so the client fetches rows in batches. With JDBC set a fetch size and turn auto-commit off; with the Python connector use `fetchmany`.','Filter, aggregate and limit in SQL before returning data.','For very large exports use `UNLOAD` to S3 and read the files, not a client query (Section 7).','The `max_cursor_result_set_size` parameter is deprecated; check the cursor constraints in the DECLARE documentation.']},
{code:`// JDBC: stream rows instead of loading everything
conn.setAutoCommit(false);
Statement st = conn.createStatement();
st.setFetchSize(10000);
ResultSet rs = st.executeQuery("SELECT * FROM big_table");`},
{h:'Keeping connections healthy'},
{ul:['Set a sensible `statement_timeout` so a runaway query cannot hold resources forever (it is 0, no limit, by default).','If queries appear to hang or fail on networks that use jumbo frames, the Management Guide recommends either allowing path MTU negotiation or setting the MTU to 1500 on the client network interface.','Enable TCP keep-alive in the driver for long-running queries behind firewalls or load balancers that drop idle flows.','Reconnect and retry on transient errors with exponential backoff.']},
{note:'Query editor v2 has its own quotas: 500 connections per account and Region by default, and 3 database connections per user.'}],
src:[['Quotas and limits',MG+'amazon-redshift-limits.html'],['Troubleshooting connection issues',MG+'troubleshooting-connections.html'],['DECLARE (cursors)',DG+'declare.html']]};

/* ================= ADDITIONAL 12 ================= */
L['rs:2:12']={blocks:[
{p:'Many companies connect on-premises tools and ETL servers to a **private** warehouse. You do this by extending your network into the VPC with a VPN or Direct Connect, not by making the warehouse public.'},
{svg:hybrid},
{h:'Choosing the link'},
{t:[['Option','What it is','Strengths','Watch out for'],
['**Site-to-Site VPN**','Encrypted tunnels over the internet to a virtual private gateway or transit gateway','Fast to set up; low cost','Bandwidth and latency vary with the internet'],
['**Direct Connect**','A dedicated private connection from your data center to AWS','Consistent bandwidth and latency; good for large loads','Takes time to provision; add a VPN as backup'],
['**Both**','Direct Connect primary, VPN backup','Resilience','More to manage']]},
{h:'What you must configure'},
{ul:['**Routing**: the VPC route tables must send on-premises ranges to the gateway, and your on-premises routers must know the VPC range.','**Security group**: allow TCP on the Redshift port, 5439 by default, from the on-premises address ranges only.','**DNS**: on-premises clients must resolve the Redshift endpoint to its **private** address. The usual approach is a Route 53 Resolver inbound endpoint, or a custom domain name for the warehouse that your DNS resolves privately.','**Firewalls**: on-premises firewalls must allow outbound traffic on the same port.']},
{h:'Checking the path'},
{code:`# From an on-premises host: does the name resolve to a private address?
nslookup lab-wg.123456789012.us-east-1.redshift-serverless.amazonaws.com

# Is the port reachable?
nc -vz <endpoint> 5439

# Then connect with psql as in the earlier lecture
psql "host=<endpoint> port=5439 dbname=dev user=awsuser sslmode=require"`},
{h:'Troubleshooting'},
{t:[['Symptom','Likely cause'],
['Name resolves to a public address','DNS is not forwarding to the VPC resolver, so traffic tries the internet'],
['Timeout on port 5439','Missing route on either side, security group source range, or on-premises firewall'],
['Works from EC2 but not on-premises','Routing or DNS only; the warehouse itself is fine'],
['Large loads are slow','VPN bandwidth; consider Direct Connect, or stage files in S3 and use `COPY`']]},
{note:'For loading big data, copying files to S3 and running COPY is almost always faster than pushing rows over a client connection, whatever the link.'}],
src:[['Redshift resources in a VPC',MG+'managing-clusters-vpc.html'],['AWS Site-to-Site VPN','https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html'],['AWS Direct Connect','https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html']]};
})();
