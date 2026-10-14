/* LearnSphere - AWS Administrator, Section 20: Production Readiness, Landing Zones & Capstone.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const lz=K.dg(700,310,[
[10,10,680,290,'A landing zone',1],
[240,35,220,40,'Management account',2],
[40,100,200,100,'Security OU|log archive account|audit account',0],[260,100,180,100,'Infrastructure OU|network account|shared services',0],[460,100,200,100,'Workloads OU|prod and non-prod|accounts per app',0],
[40,225,620,50,'Baseline in every account: CloudTrail, Config, GuardDuty, SCP guardrails, IAM Identity Center, budgets',0]],
[[350,75,140,100],[350,75,350,100],[350,75,560,100]]);

const pipe=K.dg(700,180,[
[10,10,680,160,'Change through a pipeline',1],
[25,60,110,60,'Commit|pull request',0],[160,60,110,60,'Validate|lint, plan, diff',0],[295,60,110,60,'Approve|reviewer',2],[430,60,110,60,'Deploy|assume role',0],[565,60,110,60,'Verify|alarms, tests',0]],
[[135,90,160,90],[270,90,295,90],[405,90,430,90],[540,90,565,90]]);

/* ---------- 0 ---------- */
L['aws:19:0']={blocks:[
{p:'Before a workload goes live, review it against a **production readiness checklist**. A short, honest review prevents most avoidable incidents.'},
{t:[['Area','Questions'],
['Identity','Least-privilege roles? No long-lived keys? MFA for humans? Break-glass documented?'],
['Network','Private subnets for data and app tiers? Security groups tight? Endpoints for AWS APIs? WAF where needed?'],
['Resilience','Multiple AZs? Auto Scaling and health checks? Failover tested?'],
['Data','Encrypted? Backups and restore tested? Retention set? RPO and RTO met?'],
['Monitoring','Dashboards, alarms with owners, logs retained, CloudTrail on?'],
['Operations','Runbooks, patching, on-call and escalation, change process?'],
['Cost','Budgets and alerts, tags, right-sized, commitments considered?'],
['Compliance','Required controls, evidence and ownership recorded?']]},
{h:'Using it'},
{flow:['Assign an owner for every item','Mark each item done, accepted risk or follow-up','Review with someone outside the team','Record decisions and revisit after launch']},
{note:'A readiness review is a conversation, not a form. Any item answered with "we think so" needs a test.'}],
src:[['Well-Architected Framework',K.WA+'welcome.html']]};

/* ---------- 1 ---------- */
L['aws:19:1']={blocks:[
{p:'A **landing zone** is a well-architected multi-account environment with a baseline already applied, so every new account starts secure and consistent.'},
{svg:lz},
{h:'Typical accounts'},
{t:[['Account','Purpose'],
['Management','Organizations, billing, SCPs, minimal use'],
['Log archive','Immutable central logs (CloudTrail, Config, flow logs)'],
['Audit / security','Read-only security tooling and delegated administration'],
['Network','Transit Gateway, central egress and inspection, DNS'],
['Shared services','CI/CD, image building, directories'],
['Workload accounts','One per application and environment']]},
{h:'The baseline'},
{ul:['Organization **CloudTrail** and **Config** to the log archive account.','**GuardDuty, Security Hub, Inspector** with delegated administrators.','**SCP guardrails**: deny leaving the organization, restrict Regions, protect logging and security services.','**Identity Center** access and standard permission sets.','Budgets, tag policies and a baseline VPC if used.']},
{note:'AWS Control Tower automates much of this. The concepts matter even if you build with your own templates.'}],
src:[['Landing zone',K.ORG+'orgs_getting-started_concepts.html'],['AWS Control Tower','https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html']]};

/* ---------- 2 ---------- */
L['aws:19:2']={blocks:[
{p:'A **Well-Architected review** compares a workload with the framework questions, finds risks and records improvements.'},
{flow:['Define the workload and its owner in the Well-Architected Tool','Answer the questions for each pillar honestly with the team','Review high and medium risk items','Create an improvement plan with owners and dates','Save a milestone and review again after changes']},
{h:'Tips'},
{ul:['Run it with people who operate the workload, not only designers.','Use **lenses** for serverless, SaaS or analytics where relevant.','Focus on the highest-risk items first.','Link improvement items to tickets and track them.']},
{t:[['Output','Use'],
['Risk list by pillar','Prioritize work'],
['Improvement plan','Planning and funding'],
['Milestones','Show progress over time']]},
{note:'The review is more valuable repeated than once. After a major change, run a short refresh.'}],
src:[['AWS Well-Architected Tool','https://docs.aws.amazon.com/wellarchitected/latest/userguide/intro.html']]};

/* ---------- 3 ---------- */
L['aws:19:3']={blocks:[
{p:'Every account should meet a **minimum baseline** before workloads arrive.'},
{t:[['Domain','Minimum controls'],
['Identity','No root access keys, root MFA, workforce access through Identity Center, password policy and unused credential cleanup'],
['Network','No default VPC use for workloads, private subnets for data, restrictive default security group, flow logs enabled'],
['Data','S3 account-level Block Public Access, EBS encryption by default, KMS keys for sensitive data'],
['Logging','CloudTrail all Regions, Config recording, log archive with validation'],
['Detection','GuardDuty and Security Hub enabled, findings routed to a team'],
['Guardrails','SCPs for Region and service restrictions and protection of security services'],
['Cost','Budget alerts, required tags']]},
{h:'Verify with'},
{ul:['**Config conformance packs** and **Security Hub standards** report the state of each control.','**IAM Access Analyzer** for external access findings.','**Trusted Advisor** for quick checks.']},
{code:`aws s3control get-public-access-block --account-id 111122223333
aws ec2 get-ebs-encryption-by-default
aws iam get-account-password-policy
aws iam get-account-summary --query "SummaryMap.[AccountMFAEnabled,AccountAccessKeysPresent]"`}],
src:[['Security best practices',K.IAM+'best-practices.html']]};

/* ---------- 4 ---------- */
L['aws:19:4']={blocks:[
{p:'Infrastructure and baselines should be deployed from **source control** through a **pipeline** with review and approval, not by hand.'},
{svg:pipe},
{h:'Principles'},
{ul:['**One repository, one change process**: pull requests with review.','**Plan or change set** output is attached to the review.','The pipeline uses a **short-lived role** (OIDC) with only deployment permissions per environment.','**Separate** non-production and production pipelines, with approval before production.','Roll back by deploying the previous version from Git.']},
{t:[['Stage','Typical checks'],
['Validate','Template lint, policy checks (cfn-guard), formatting'],
['Plan','Change set or terraform plan'],
['Approve','Human review for production'],
['Deploy','Assume role, apply, wait for completion'],
['Verify','Smoke tests, alarms, drift check']]},
{note:'Manual console changes in a pipeline-managed environment create drift. Make console access read-only for production where possible.'}],
src:[['CI/CD on AWS','https://docs.aws.amazon.com/whitepapers/latest/practicing-continuous-integration-continuous-delivery/welcome.html']]};

/* ---------- 5 ---------- */
L['aws:19:5']={blocks:[
{p:'Operating a production system safely depends on **how changes are made** and **what is written down**.'},
{h:'Change management'},
{ul:['Classify changes: **standard** (pre-approved, low risk), **normal** (review and schedule) and **emergency**.','Include **impact, rollback plan, test evidence and timing** in the request.','Prefer **small, frequent** changes over large batches.','Avoid risky changes during peak hours or before holidays.']},
{h:'Runbooks'},
{t:[['Runbook element','Content'],
['Trigger','The alarm or symptom that starts it'],
['Steps','Exact commands or console steps, with expected results'],
['Verification','How to confirm the fix'],
['Escalation','Who to call and when'],
['Automation','Link to the SSM Automation runbook where available']]},
{h:'Documentation to keep'},
{ul:['Architecture diagrams and account and Region inventory.','Dependency and ownership list.','Recovery procedures and last test results.','Decision records for important trade-offs.']},
{note:'Turn every repeated manual runbook into an Automation document or a script. Documents explain, automation executes.'}],
src:[['Operational excellence',K.WA+'operational-excellence.html']]};

/* ---------- 6 ---------- */
L['aws:19:6']={blocks:[
{p:'**Capstone:** build, secure, monitor, back up and recover a production-style environment. It ties the sections together.'},
{h:'Requirements'},
{t:[['Area','Deliver'],
['Governance','Organization with an OU, SCP guardrail, Identity Center access and budget'],
['Network','VPC across two AZs with public, app and data subnets, NAT, endpoints, flow logs'],
['Compute','ALB and an Auto Scaling group built from a launch template with IMDSv2 and SSM access'],
['Data','Multi-AZ database in private subnets, encrypted, with a secret in Secrets Manager'],
['Delivery','Everything deployed with CloudFormation from a repository'],
['Observability','Dashboard, alarms to SNS, CloudTrail and log retention'],
['Protection','AWS Backup plan with cross-Region copy, GuardDuty and Security Hub'],
['Recovery','Documented runbook and a tested restore']]},
{h:'Break and recover'},
{flow:['Terminate an instance and confirm self-healing','Fail over the database','Delete a bucket object and recover it from a version','Restore the database to a point in time in another Region','Introduce a permission error and diagnose it with the method','Write the readiness review and runbook, then tear everything down']},
{note:'Keep notes and screenshots as you go. The capstone is a portfolio item and the best exam preparation.'}],
src:[['AWS Well-Architected Labs','https://wellarchitectedlabs.com/']]};
})();
