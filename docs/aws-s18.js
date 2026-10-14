/* LearnSphere - AWS Administrator, Section 18: Security & Data Protection.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const layers=K.dg(700,260,[
[10,10,680,240,'Defence in depth',1],
[40,45,620,32,'Identity: IAM, MFA, SCPs, least privilege',2],
[40,85,620,32,'Network: VPC, security groups, WAF, private endpoints',0],
[40,125,620,32,'Compute and workload: patching, IMDSv2, Inspector',0],
[40,165,620,32,'Data: KMS encryption, Macie, backups',0],
[40,205,620,32,'Detect and respond: CloudTrail, GuardDuty, Security Hub, Config',0]],
[]);

const kms=K.dg(700,230,[
[10,10,680,210,'Envelope encryption with KMS',1],
[30,70,150,60,'KMS key|never leaves KMS',2],[240,70,170,60,'Data key|plaintext + encrypted',0],[470,70,200,60,'Your data|encrypted with data key',0],
[240,150,170,45,'Encrypted data key|stored with the data',0]],
[[180,100,240,100],[410,100,470,100],[325,130,325,150]]);

/* ---------- 0 ---------- */
L['aws:17:0']={blocks:[
{p:'Security on AWS is **layered**. No single control is enough, so identity, network, workload, data and detection each add protection.'},
{svg:layers},
{h:'Principles'},
{ul:['**Identity is the perimeter**: strong authentication, least privilege, no long-lived keys.','**Zero trust**: do not trust a request because of its network location. Verify identity and authorization every time.','**Defence in depth**: assume one layer fails.','**Automate** security checks and remediation.','**Log everything** relevant and protect the logs.']},
{t:[['Layer','Main AWS controls'],
['Identity','IAM, Identity Center, MFA, SCPs, permission boundaries'],
['Network','VPC design, security groups, endpoints, WAF, Shield, Network Firewall'],
['Workload','Patch Manager, IMDSv2, Inspector, minimal roles'],
['Data','KMS, S3 encryption, Macie, Secrets Manager, backups'],
['Detection','CloudTrail, Config, GuardDuty, Security Hub']]},
{note:'The shared responsibility model puts configuration of all these controls with you. AWS provides the tools and secures the underlying cloud.'}],
src:[['Security pillar',K.WA+'security.html']]};

/* ---------- 1 ---------- */
L['aws:17:1']={blocks:[
{p:'**Amazon Macie** discovers and classifies **sensitive data in S3** such as personal data and credentials, and reports bucket exposure.'},
{ul:['**Automated discovery** samples objects across buckets and builds a sensitivity view.','**Sensitive data discovery jobs** scan chosen buckets in depth.','**Managed data identifiers** recognize names, national IDs, card numbers and keys. You can add custom identifiers.','**Findings** go to the console, Security Hub and EventBridge.','Bucket inventory shows public access, encryption and sharing status.']},
{code:`aws macie2 enable-macie
aws macie2 create-classification-job --job-type ONE_TIME --name pii-scan --s3-job-definition \\
  '{"bucketDefinitions":[{"accountId":"111122223333","buckets":["my-data"]}]}'
aws macie2 list-findings --max-results 10`},
{h:'Typical response'},
{flow:['A finding reports sensitive data in a public or shared bucket','Confirm whether the data should be there','Restrict access or move and encrypt the data','Add a lifecycle or retention rule where needed','Record the result and tune the bucket classification']},
{note:'Macie is scoped to S3. For databases and other stores use their own discovery and classification tools.'}],
src:[['Amazon Macie','https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html']]};

/* ---------- 2 ---------- */
L['aws:17:2']={blocks:[
{p:'**AWS Key Management Service (KMS)** creates and controls the keys that encrypt your data. Keys never leave KMS in plaintext.'},
{svg:kms},
{t:[['Key type','Managed by','Notes'],
['AWS owned key','AWS, invisible','Default for some services, no control'],
['AWS managed key (aws/s3 and so on)','AWS in your account','Visible, automatic rotation yearly, limited policy control'],
['Customer managed key','You','Full key policy control, rotation, grants, cost per key']]},
{h:'Access control'},
{ul:['A **key policy** is required and is the primary control. IAM policies work only if the key policy allows IAM.','**Grants** give temporary, narrow permissions to services such as EBS.','**Aliases** such as `alias/app-data` decouple names from key IDs.','**Rotation** of customer managed keys: automatic yearly for symmetric keys.','Every use is logged in **CloudTrail**.']},
{code:`aws kms create-key --description "app data" --key-usage ENCRYPT_DECRYPT
aws kms create-alias --alias-name alias/app-data --target-key-id <key-id>
aws kms enable-key-rotation --key-id <key-id>
aws kms schedule-key-deletion --key-id <key-id> --pending-window-in-days 30`},
{note:'Deleting a key makes all data encrypted with it unrecoverable. Use disable first, and the 30 day pending window if you must delete.'}],
src:[['AWS KMS',K.KMS+'overview.html']]};

/* ---------- 3 ---------- */
L['aws:17:3']={blocks:[
{p:'Most AWS storage and database services support encryption at rest with KMS. Know which are **on by default**, and enforce the rest.'},
{t:[['Service','Default','How to enforce'],
['S3','SSE-S3 on for new objects','Bucket policy and default encryption with KMS'],
['EBS','Off, unless enabled by default per Region','Enable EBS encryption by default'],
['RDS and Aurora','Choice at creation','Config rule rds-storage-encrypted, SCP'],
['DynamoDB','Always encrypted (owned or KMS key)','Choose a customer managed key if needed'],
['EFS','Choice at creation','Config rule, SCP on elasticfilesystem:CreateFileSystem'],
['SQS and SNS','SSE available','Config rules and policy'],
['CloudWatch Logs','Encrypted by default, optional KMS','Associate a key with the log group']]},
{h:'Enforcing'},
{ul:['**SCPs** can deny creation of unencrypted volumes or databases with a condition on `ec2:Encrypted` or `rds:StorageEncrypted`.','**Config rules and conformance packs** detect gaps.','**Account-level defaults** reduce reliance on each team.']},
{code:`aws ec2 enable-ebs-encryption-by-default
aws ec2 modify-ebs-default-kms-key-id --kms-key-id alias/ebs
aws configservice put-config-rule --config-rule file://encrypted-volumes.json`}],
src:[['Data protection',K.WA+'sec-dataprot.html']]};

/* ---------- 4 ---------- */
L['aws:17:4']={blocks:[
{p:'**Encryption in transit** protects data on the network with TLS. **AWS Certificate Manager (ACM)** issues and renews public and private certificates for integrated services.'},
{h:'ACM'},
{ul:['**Public certificates** are free for use with ALB, NLB TLS listeners, CloudFront and API Gateway.','Certificates **renew automatically** when DNS validation records stay in place.','Use **DNS validation** with a CNAME record that remains permanently, not email validation.','CloudFront needs its certificate in **us-east-1**. Regional services need it in their own Region.','Private CA issues internal certificates.']},
{code:`aws acm request-certificate --domain-name www.example.com --validation-method DNS
aws acm describe-certificate --certificate-arn <arn> --query Certificate.[Status,DomainValidationOptions[0].ResourceRecord]
aws acm list-certificates --certificate-statuses ISSUED PENDING_VALIDATION`},
{h:'Enforcing TLS'},
{ul:['ALB listener redirect from HTTP to HTTPS and a modern **security policy**.','S3 bucket policy denying `aws:SecureTransport = false`.','RDS and other engines: require SSL parameters.','**Config rules** for ELB listeners and certificate expiry.']},
{note:'A certificate stuck in PENDING_VALIDATION nearly always means the validation CNAME was not created in the correct hosted zone.'}],
src:[['AWS Certificate Manager','https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html']]};

/* ---------- 5 ---------- */
L['aws:17:5']={blocks:[
{p:'Secrets such as passwords and API keys should be stored in a service, never in code, AMIs or environment files.'},
{t:[['','Secrets Manager','Parameter Store SecureString'],
['Purpose','Secrets with lifecycle','Configuration and simple secrets'],
['Automatic rotation','Yes, built-in for RDS and others','No'],
['Versioning','Staging labels (AWSCURRENT)','Versions'],
['Cross-account sharing','Resource policy','Limited'],
['Cost','Per secret per month plus API calls','Free standard tier']]},
{code:`aws secretsmanager create-secret --name prod/db/app --secret-string '{"username":"app","password":"..."}'
aws secretsmanager get-secret-value --secret-id prod/db/app --query SecretString --output text
aws secretsmanager rotate-secret --secret-id prod/db/app --rotation-lambda-arn <arn> --rotation-rules AutomaticallyAfterDays=30`},
{h:'Good practice'},
{ul:['Retrieve at runtime through the **IAM role** of the workload.','Rotate regularly and make sure applications re-read the secret.','Restrict by resource policy and KMS key permissions.','Use RDS **managed master user password** so rotation is automatic.']},
{note:'Retrieval permissions and the KMS key permission are separate. A role may need both to read a secret.'}],
src:[['AWS Secrets Manager','https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html']]};

/* ---------- 6 ---------- */
L['aws:17:6']={blocks:[
{p:'**Amazon GuardDuty** continuously analyses CloudTrail, VPC Flow Logs and DNS logs, plus optional data sources, to detect threats **without agents or logging setup**.'},
{h:'Findings and protection plans'},
{t:[['Finding type example','Meaning'],
['UnauthorizedAccess:EC2/SSHBruteForce','Brute force attempts against SSH'],
['Recon:EC2/PortProbeUnprotectedPort','A port is being probed'],
['CryptoCurrency:EC2/BitcoinTool.B','Instance contacting mining pools'],
['Backdoor:EC2/C2Activity.B','Communication with a command server'],
['UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration','Instance credentials used from elsewhere']]},
{ul:['Optional **protection plans**: S3, EKS, Malware Protection, RDS login events, Lambda.','Findings have **severity** (low, medium, high).','Use **delegated administrator** and enable in all accounts and Regions.','Send findings to **EventBridge** for notification and automated response.']},
{code:`aws guardduty create-detector --enable
aws guardduty list-findings --detector-id <id> --finding-criteria '{"Criterion":{"severity":{"Gte":7}}}'
aws guardduty get-findings --detector-id <id> --finding-ids <ids>`},
{note:'A finding is a lead, not a verdict. Triage it: confirm the resource, check recent activity in CloudTrail and decide to contain, ignore or fix.'}],
src:[['Amazon GuardDuty','https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html']]};

/* ---------- 7 ---------- */
L['aws:17:7']={blocks:[
{p:'**AWS Security Hub** aggregates findings from AWS services and partners, and runs **security standards checks** with a normalized format.'},
{t:[['Capability','Detail'],
['Aggregation','Findings from GuardDuty, Inspector, Macie, Config and others in one format (ASFF/OCSF)'],
['Standards','AWS Foundational Security Best Practices, CIS AWS Foundations, PCI DSS, NIST'],
['Cross-Region and account','Administrator account with aggregation Region'],
['Automation rules','Suppress or update findings automatically'],
['Custom actions and EventBridge','Trigger remediation workflows']]},
{h:'Working with it'},
{flow:['Enable Security Hub and Config in every account and Region through the organization','Choose the standards that apply','Review failed controls by severity','Remediate manually or with automation, or suppress with a reason','Track the security score over time']},
{code:`aws securityhub enable-security-hub --enable-default-standards
aws securityhub get-findings --filters '{"SeverityLabel":[{"Value":"CRITICAL","Comparison":"EQUALS"}],"RecordState":[{"Value":"ACTIVE","Comparison":"EQUALS"}]}'`},
{note:'Security Hub checks depend on AWS Config recording. If controls show no data, confirm Config is enabled for the resource types.'}],
src:[['AWS Security Hub','https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html']]};

/* ---------- 8 ---------- */
L['aws:17:8']={blocks:[
{p:'**Amazon Inspector** scans for **software vulnerabilities** and unintended network exposure in EC2 instances, container images in ECR and Lambda functions. It scans continuously and automatically.'},
{t:[['Target','What is checked'],
['EC2 instances','OS and application package vulnerabilities (needs SSM Agent for deep scan) and network reachability'],
['ECR images','Vulnerabilities on push and continuously as new CVEs appear'],
['Lambda functions','Dependency vulnerabilities and code scanning']]},
{ul:['Findings include **CVE, severity, exploit availability** and a risk score for your environment.','Enable it organization-wide with a delegated administrator.','Results flow to Security Hub and EventBridge.','**Inspector Classic has ended.** Only the current Inspector service is available.']},
{code:`aws inspector2 enable --resource-types EC2 ECR LAMBDA
aws inspector2 list-findings --filter-criteria '{"severity":[{"comparison":"EQUALS","value":"CRITICAL"}]}' --max-results 10`},
{note:'Inspector finds the vulnerability. Patch Manager, image rebuilds and function updates fix it. Link the two in your process.'}],
src:[['Amazon Inspector','https://docs.aws.amazon.com/inspector/latest/user/what-is-inspector.html']]};

/* ---------- 9 ---------- */
L['aws:17:9']={blocks:[
{p:'**Practical:** harden an account by turning on detection, encryption and secrets handling, then reviewing what appears.'},
{flow:['Enable CloudTrail organization trail, Config and the Security Hub standards','Enable GuardDuty and Inspector for the lab account','Turn on EBS encryption by default and S3 account-level Block Public Access','Create a customer managed KMS key and encrypt a bucket and a volume with it','Store a database password in Secrets Manager and read it from an instance role','Generate a harmless finding using GuardDuty sample findings','Review Security Hub, assign owners and clean up']},
{t:[['Area','Evidence'],
['Detection','Findings visible in GuardDuty and Security Hub'],
['Encryption','Volumes and buckets show the KMS key'],
['Secrets','No password in instance user data or code'],
['Posture','Security score and failed controls listed']]},
{note:'Sample findings let you practise triage without any real threat. Archive them after the lab.'}],
src:[['Security Hub getting started','https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-get-started.html']]};
})();
