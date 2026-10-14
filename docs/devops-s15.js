/* LearnSphere - DevOps & CI/CD, Section 15: Secrets, Identity & Access in Pipelines.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const leak=K.dg(700,260,[
[10,10,680,240,'Where pipeline secrets leak',1],
[30,50,150,50,'Logs and debug output',0],[200,50,150,50,'Artifacts and caches',0],[370,50,150,50,'Images and layers',0],
[30,140,150,50,'Forks and PRs',0],[200,140,150,50,'Third-party actions',0],[370,140,150,50,'Environment dumps',0],[545,90,125,60,'Result: reusable|credentials for an|attacker',2]],
[[520,75,545,105],[520,165,545,135]]);

const fed=K.dg(700,220,[
[10,10,680,200,'Identity federation replaces stored keys',1],
[30,70,140,70,'Pipeline job|presents signed|identity token',0],[240,70,150,70,'Cloud identity|provider verifies|trust rules',2],[460,70,140,70,'Short-lived|access token|scoped role',0]],
[[170,105,240,105],[390,105,460,105]]);

const vault=K.dg(700,220,[
[10,10,680,200,'Dynamic secrets from Vault',1],
[30,80,120,60,'Pipeline|authenticates',0],[210,80,130,60,'Vault checks|identity and policy',2],[400,80,130,60,'Creates a unique|database user',0],[570,80,100,60,'Expires after|minutes',0]],
[[150,110,210,110],[340,110,400,110],[530,110,570,110]]);

/* ---------- 0 ---------- */
L['devops:14:0']={blocks:[
{p:'Pipelines handle the most valuable secrets in a company: cloud keys, registry credentials, signing keys. They are also complex systems that print a lot of text. Secrets leak through predictable paths.'},
{svg:leak},
{t:[['Leak path','How it happens','Prevention'],
['**Logs**','A command echoes a variable, `set -x` traces it, an error prints a URL with a token','Mask, avoid `set -x` near secrets, do not print environment'],
['**Artifacts and caches**','A config file with a secret is uploaded or cached','Exclude secret files, scan artifacts'],
['**Images**','A secret copied or passed as a build argument remains in a layer','BuildKit secret mounts, never COPY secrets'],
['**Forks and pull requests**','Untrusted code reads the job\'s secrets','No secrets for untrusted triggers'],
['**Third-party actions**','A compromised dependency reads the environment','Pin, least privilege, avoid giving secrets broadly'],
['**Debug output**','Verbose or debug logging exposes headers and bodies','Disable debug in shared logs; clean up']]},
{note:'The best secret is the one that does not exist. Prefer federated identity and short-lived credentials over stored values (the next lessons).'}],
src:[['OWASP: insufficient credential hygiene',K.OWASP]]};

/* ---------- 1 ---------- */
L['devops:14:1']={blocks:[
{p:'Every CI platform stores secrets and **masks** them in logs. Masking is helpful, but it is **not** a security boundary.'},
{h:'What masking does and does not do'},
{t:[['Does','Does not'],
['Replaces the exact secret string with asterisks in logs','Stop code in the job from reading the value'],
['Reduces accidental exposure in console output','Catch encoded, split or transformed values (base64, reversed, characters spaced)'],
['','Protect secrets from malicious actions or pull request code']]},
{h:'Scoping tightly'},
{t:[['Platform','Narrowing options'],
['GitHub Actions','Environment secrets with required reviewers and branch rules; per-step `env`'],
['GitLab CI/CD','Protected and environment-scoped variables; masked and hidden'],
['Jenkins','Folder-scoped credentials; `withCredentials` blocks']]},
{ul:['Give each environment its **own** secret with its own value.','Restrict production secrets to **protected branches** and approved environments.','Pass a secret only to the **step** that needs it, never to the whole job.','Use **different secrets per pipeline**, so one leak has limited reach.']},
{note:'If a job runs untrusted code (a pull request from a fork), it must have **no** secrets at all. Masking cannot save you there.'}]};

/* ---------- 2 ---------- */
L['devops:14:2']={blocks:[
{p:'Instead of storing a cloud key in the CI platform, the job presents a **signed identity token** (OIDC). The cloud verifies the token and returns **temporary credentials**. There is nothing long-lived to steal.'},
{svg:fed},
{t:[['Cloud','Trust object','Typical action or flow'],
['**AWS**','IAM OIDC identity provider and an IAM role with a trust policy','`aws-actions/configure-aws-credentials` with `role-to-assume`'],
['**Azure**','Federated credential on an Entra application or managed identity','`azure/login` with client, tenant and subscription IDs (no secret)'],
['**Google Cloud**','Workload Identity Federation pool and provider','`google-github-actions/auth` with workload identity provider']]},
{h:'Always restrict the trust'},
{p:'Without conditions, any pipeline could assume the role. Bind the trust to specific claims.'},
{code:`{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:acme/app:environment:production"
    }
  }
}`},
{ul:['Pin the **audience** and a **subject** that names repository and environment or branch.','Use separate roles for plan and apply, and for each environment.','GitLab, Jenkins and others can federate in the same way with their own OIDC issuers.']}],
src:[['GitHub OIDC with AWS',K.GH+'security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services'],['GitLab OIDC',K.GL+'secrets/id_token_authentication/']]};

/* ---------- 3 ---------- */
L['devops:14:3']={blocks:[
{p:'A **secret manager** is a central store with access control, audit and rotation. Pipelines authenticate to it and fetch values at run time.'},
{t:[['','HashiCorp Vault / OpenBao','Cloud secret managers'],
['Examples','Vault, OpenBao','AWS Secrets Manager, Azure Key Vault, Google Secret Manager'],
['Strength','Dynamic secrets, many backends, multi-cloud','Native identity integration, managed service'],
['Operations','You run it (or use HCP Vault)','Provider operates it'],
['Fits','Hybrid or multi-cloud, short-lived database and cloud credentials','Workloads inside one cloud']]},
{svg:vault},
{h:'Dynamic secrets'},
{p:'Instead of one shared database password, Vault creates a **unique user** for each request with a short **time to live**, and removes it afterward. A leaked credential expires on its own.'},
{code:`# GitHub Actions: authenticate to Vault with the job's OIDC token
- uses: hashicorp/vault-action@v3
  with:
    url: https://vault.example.com
    method: jwt
    role: ci-deploy
    secrets: |
      database/creds/app username | DB_USER ;
      database/creds/app password | DB_PASS`},
{h:'Choosing'},
{ul:['Start with the secret manager of the cloud you deploy to.','Add Vault when you need dynamic secrets or one control plane across environments.','Authenticate **with identity (OIDC)**, not with another stored token.']}],
src:[['Vault',  'https://developer.hashicorp.com/vault/docs'],['OpenBao','https://openbao.org/docs/']]};

/* ---------- 4 ---------- */
L['devops:14:4']={blocks:[
{p:'Applications running in Kubernetes also need secrets. In a GitOps setup you cannot store them in Git. Two patterns **bring secrets from a manager into the cluster**.'},
{t:[['Pattern','How it works','Result'],
['**External Secrets Operator**','A controller reads from a secret manager and creates a normal Kubernetes Secret','Pods consume a Secret as usual'],
['**Secrets Store CSI Driver**','Mounts secrets from a manager into the pod as files at start-up','Secret may exist only in the pod, optionally synced as a Secret']]},
{svg:K.dg(700,200,[
[10,10,680,180,'External Secrets',1],
[30,70,140,60,'Secret manager|Vault or cloud',0],[250,70,150,60,'External Secrets|controller',2],[480,70,190,60,'Kubernetes Secret|used by pods',0]],
[[170,100,250,100],[400,100,480,100]])},
{ul:['Authenticate the controller with **workload identity** (IRSA, Azure Workload Identity, GKE Workload Identity), not a stored key.','Set a **refresh interval** so rotated values reach pods. Applications may need a reload or restart.','Restrict which namespaces may read which secrets with RBAC and store scoping.','Remember a Kubernetes Secret is only base64. Enable **encryption at rest** and restrict access.']}],
src:[['External Secrets',  'https://external-secrets.io/latest/'],['Secrets Store CSI Driver','https://secrets-store-csi-driver.sigs.k8s.io/']]};

/* ---------- 5 ---------- */
L['devops:14:5']={blocks:[
{p:'A single shared deploy account with admin rights is a convenient shortcut that turns any one leak into a full compromise. Give each pipeline its own **narrow identity**.'},
{t:[['Anti-pattern','Better'],
['One "ci-admin" account used by every pipeline','One identity per application and environment'],
['Admin or owner role','Only the permissions the job needs (deploy to one namespace, push to one repository)'],
['Same identity for plan and apply','Read-only for plan, write for apply'],
['Long-lived keys shared by humans and CI','Separate human and machine identities, with federation for CI'],
['Permissions never reviewed','Periodic access review and removal of unused grants']]},
{h:'How to design it'},
{flow:['List what the pipeline must do, step by step','Grant exactly those actions on exactly those resources','Add conditions: branch, environment, time','Test by trying an action that should be denied','Review permissions regularly and use access analysis tools']},
{ul:['In Kubernetes, give the deployer a **Role** limited to a namespace, not cluster-admin.','Prefer **GitOps pull** so no outside system needs cluster write access at all.','Log and alert on use of high-privilege identities.']}]};

/* ---------- 6 ---------- */
L['devops:14:6']={blocks:[
{p:'When a secret leaks, speed and order matter. The sequence is **revoke, investigate, rotate, learn**.'},
{flow:['Revoke or disable the credential immediately','Contain: check what it could access and for what period','Investigate: audit logs for use by anyone else','Rotate: issue a new secret and update consumers','Remove the secret from code and history','Review and fix the cause']},
{t:[['Step','Detail'],
['Revoke first','Do not wait for investigation. A live credential keeps risk open'],
['Scope the impact','Which systems, which data, which time window?'],
['Rotate everywhere it was used','Services, pipelines, and any copy in other tools'],
['Detect misuse','Look for logins from unknown addresses, new resources, large data transfers'],
['Notify','Security team, and affected parties if data was exposed'],
['Prevent','Add scanning, tighten scope, move to short-lived credentials']]},
{h:'Make rotation easy before you need it'},
{ul:['Have **one place** that defines each secret and its consumers.','Automate rotation where the provider allows it.','Practise a rotation drill regularly. A rotation never tested will fail during an incident.']},
{note:'Treat any secret that appeared in a log or a public place as compromised, even if you removed it quickly.'}]};

/* ---------- 7 ---------- */
L['devops:14:7']={blocks:[
{p:'Remove a long-lived cloud key from a pipeline and use federated identity and dynamic credentials instead.'},
{flow:['Identify a pipeline that uses a stored cloud access key','Create the OIDC trust and a scoped role','Update the workflow to request an ID token and assume the role','Remove the stored key from the platform and delete it in the cloud','Add Vault for a dynamic database credential']},
{code:`# BEFORE
env:
  AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}

# AFTER
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@v4
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gha-deploy-prod
      aws-region: eu-west-1
  - run: aws sts get-caller-identity`},
{h:'Check yourself'},
{ul:['Does the job still work from a feature branch? It should be denied if the trust is on main.','Where is the old key now? It must be revoked in the cloud, not only removed from the platform.','How long does the new credential live?','Which claim in the token does the trust policy check?']}]};
})();
