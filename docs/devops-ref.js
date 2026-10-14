/* LearnSphere - DevOps & CI/CD Quick Reference (cheat sheet).
   window.QREF['devops'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Syntax written from memory for current platforms. Check vendor documentation before relying on exact flags. */
window.QREF=window.QREF||{};
window.QREF['devops']={title:'DevOps & CI/CD Quick Reference',blurb:'Key concepts, maps and commands for delivery pipelines, GitOps, supply-chain security and operations, plus platform equivalents and troubleshooting.',hint:'canary',pages:[
{t:'Key concepts',d:'The ideas every delivery engineer should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, an optional command and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'DevOps',s:'Shared ownership of delivery and operation.',
 a:'DevOps is a set of cultural habits and technical practices that let one team build, ship and run software together. It is not a role, a tool or a team between developers and operations.',
 w:'Tools alone do not change delivery speed. Ownership and feedback do.',see:[0,1,'What DevOps Is: Culture, Practices and the Problems It Solves']},
{t:'Value stream and lead time',s:'Where a change waits.',
 a:'A value stream is the path a change takes from idea to production. Lead time is mostly waiting (review, queue, approval), not working.',
 w:'Improve the constraint. Faster builds do not help if approvals wait for days.',see:[0,2,'The Software Delivery Lifecycle and Value Stream']},
{t:'CI, delivery and deployment',s:'Three precise terms.',
 a:'Continuous integration merges small changes often with automatic verification. Continuous delivery keeps every passing change releasable with a deliberate release step. Continuous deployment releases automatically.',
 w:'Teams often claim the third while practising the first.',see:[0,3,'CI, Continuous Delivery and Continuous Deployment Defined']},
{t:'DORA four key metrics',s:'Throughput and stability.',
 a:'Deployment frequency and lead time for changes measure throughput. Change failure rate and time to restore service measure stability. High performers do well on both.',
 w:'Use them to find constraints, never to rank people.',see:[0,4,'DORA Four Key Metrics: Throughput and Stability']},
{t:'Fast feedback and small batches',s:'Design rules of a healthy pipeline.',
 a:'Cheap, quick checks run first. Changes are small and frequent. Every step is automated and idempotent.',
 w:'Slow feedback makes people batch work, which makes changes bigger and riskier.',see:[0,7,'Principles That Keep Pipelines Healthy']}
]},

{h:'Source and CI'},
{acc:[
{t:'Git commits and branches',s:'Snapshots and pointers.',
 a:'A commit is a snapshot with parent links. A branch is a movable pointer. A tag is a fixed pointer. The SHA identifies exactly one snapshot.',
 w:'A SHA is a safe, immutable reference for pipelines.',
 c:`git log --oneline --graph --decorate`,see:[2,0,'How Git Works: Commits, Branches, Refs and the Object Model']},
{t:'Branching strategy',s:'How often work is integrated.',
 a:'Trunk-based development integrates to main many times a day. GitHub Flow uses short branches and pull requests. GitFlow adds long-lived release branches.',
 w:'Longer-lived branches delay feedback and make merges painful.',see:[2,3,'Branching Strategies: Trunk-Based Development, GitHub Flow and GitFlow']},
{t:'Branch protection and rulesets',s:'Rules the platform enforces.',
 a:'Require pull requests, approvals, status checks and block force pushes, with no bypass. CODEOWNERS routes review to owners.',
 w:'A check that can be skipped is not a gate.',see:[2,5,'Branch Protection, Rulesets and CODEOWNERS']},
{t:'Pipeline anatomy',s:'Trigger, stage, job, step, runner.',
 a:'A trigger starts a pipeline made of stages. Stages hold jobs. Jobs run steps on a runner. Jobs normally start from a clean environment.',
 w:'The same vocabulary maps across GitHub, GitLab and Jenkins.',see:[3,1,'Anatomy of a Pipeline: Triggers, Stages, Jobs, Steps and Runners']},
{t:'Artifact and cache',s:'Output versus optimisation.',
 a:'An artifact is an output you keep and pass on. A cache speeds up repeated work and must never be required for correctness.',
 w:'Mixing the two causes mysterious failures or stale results.',see:[3,5,'Caching Dependencies and Build Outputs']},
{t:'Pipeline as code',s:'Definitions live in the repository.',
 a:'The pipeline file is versioned, reviewed and recoverable like application code.',
 w:'Protect pipeline files with CODEOWNERS because they define the gate.',see:[3,8,'Pipeline as Code: Keeping Definitions in the Repository']}
]},

{h:'Platforms'},
{acc:[
{t:'GitHub Actions model',s:'Events, workflows, jobs, steps, runners.',
 a:'An event triggers a workflow made of jobs that run on runners. Steps run shell commands or reusable actions. Jobs run in parallel unless needs orders them.',
 w:'Know the model and every other platform feature is a variation.',see:[4,0,'GitHub Actions Architecture: Workflows, Events, Jobs, Steps and Runners']},
{t:'GITHUB_TOKEN permissions',s:'Least privilege per job.',
 a:'Each run gets a short-lived token whose rights come from the permissions key. Set the default to read-only and add per job.',
 w:'A compromised step can only do what the token allows.',see:[5,3,'The `GITHUB_TOKEN` and Least-Privilege Permissions']},
{t:'OIDC federation',s:'No stored cloud keys.',
 a:'The job presents a signed identity token and the cloud returns temporary credentials. Trust is restricted by claims such as repository and environment.',
 w:'Nothing long-lived exists to steal.',see:[5,4,'OpenID Connect: Authenticating to Cloud Providers Without Stored Secrets']},
{t:'Pinning actions',s:'Mutable tags versus commit SHAs.',
 a:'A tag can be moved by its owner or an attacker. A full commit SHA cannot. Bots keep pinned SHAs current.',
 w:'Third-party actions run with your token and secrets.',see:[5,5,'Pinning Actions to Commit SHAs and Using Immutable Releases']},
{t:'GitLab rules, needs and runners',s:'The GitLab core.',
 a:'rules decide whether a job runs. needs builds a directed acyclic graph that skips stage waiting. Tags route jobs to runners with an executor.',
 w:'Rules, not only/except, are the supported mechanism.',see:[6,1,'`.gitlab-ci.yml` Essentials: `script`, `image`, `stages` and `rules`']},
{t:'Jenkins controller and agents',s:'Keep builds off the controller.',
 a:'The controller schedules and stores configuration. Agents run builds on executors. Plugins provide most features.',
 w:'The controller holds credentials, so set its executors to zero and prefer ephemeral agents.',see:[7,0,'Jenkins Architecture: Controller, Agents, Executors and Plugins']}
]},

{h:'Delivery'},
{acc:[
{t:'Build once, promote',s:'One artifact through every environment.',
 a:'Build a single immutable artifact per commit and promote that same artifact. Only configuration changes between environments.',
 w:'What you tested is what you deploy.',see:[8,0,'Artifact Management: Why Build Once and Promote']},
{t:'Image tags and digests',s:'Mutable labels versus content hashes.',
 a:'A tag can move. A digest cannot. Never deploy latest and prefer digests for reproducibility.',
 w:'Sign and attest the digest, not a tag.',
 c:`docker buildx imagetools inspect app:1.4.2`,see:[8,4,'Tagging and Versioning Images: Immutable Tags and Digests']},
{t:'Test pyramid',s:'Many fast tests, few slow ones.',
 a:'Unit tests are many and fast. Integration tests use real services. End-to-end tests are few and run against a deployed environment.',
 w:'An inverted pyramid gives a slow, flaky pipeline.',see:[9,0,'The Test Pyramid and Where Each Test Runs in the Pipeline']},
{t:'Deployment strategies',s:'Recreate, rolling, blue/green, canary.',
 a:'Recreate has downtime. Rolling replaces gradually. Blue/green switches two full environments. Canary widens exposure while health holds.',
 w:'Choose by risk, capacity cost and rollback speed.',see:[10,3,'Rolling and Recreate Deployments']},
{t:'Feature flags',s:'Deploy is not release.',
 a:'A flag turns behaviour on or off at run time, so code can ship dark and be enabled gradually or switched off instantly.',
 w:'Every flag needs an owner and a removal date.',see:[10,6,'Feature Flags and Decoupling Deploy from Release']},
{t:'Expand and contract',s:'Safe schema changes.',
 a:'Add the new structure, run code that uses both, backfill, then remove the old structure in a later release.',
 w:'Old and new versions run together during a rollout.',see:[10,8,'Rollbacks, Roll-Forward and Safe Database Changes']}
]},

{h:'GitOps and infrastructure'},
{acc:[
{t:'GitOps principles',s:'Declarative, versioned, pulled, reconciled.',
 a:'Desired state is declared and stored in Git. Agents pull it automatically and continuously reconcile the system to it.',
 w:'Rollback is git revert and drift is corrected, not accumulated.',see:[11,0,'GitOps Principles: Declarative, Versioned, Pulled and Continuously Reconciled']},
{t:'Push versus pull',s:'Where the credentials live.',
 a:'In push, the pipeline holds cluster credentials. In pull, an agent inside the cluster reads Git and needs only read access.',
 w:'A compromised pipeline can no longer change production directly.',see:[11,1,'Push vs Pull Deployment Models']},
{t:'Argo CD sync and health',s:'Two separate statuses.',
 a:'Sync status says whether live state matches Git. Health says whether resources work. selfHeal reverts manual changes and prune removes deleted resources.',
 w:'Synced but Degraded is a real and common state.',
 c:`argocd app get sample-app`,see:[11,4,'Syncing, Health, Drift and Self-Heal in Argo CD']},
{t:'Config repository',s:'Separate code from desired state.',
 a:'Keep application code and deployment configuration apart. Promote by pull request changing an overlay directory.',
 w:'Config commits should not trigger application builds.',see:[11,6,'Repository Structure: App Repo vs Config Repo and Environment Promotion']},
{t:'Plan on pull request, apply on merge',s:'Reviewed infrastructure change.',
 a:'Validate and plan on every pull request, review the plan, then apply from main behind an approval. Use separate state per environment.',
 w:'The plan is what actually changes, so review it.',
 c:`terraform plan -input=false -out=tfplan`,see:[12,1,'Terraform in CI: `fmt`, `validate`, Plan on Pull Request and Apply on Merge']},
{t:'Policy as code',s:'Rules that run automatically.',
 a:'Tools such as OPA and Conftest evaluate plans and manifests against policies, and admission controllers enforce them in the cluster.',
 w:'Start advisory, then enforce.',
 c:`conftest test plan.json --policy policy/`,see:[12,3,'Policy as Code: OPA, Conftest and Sentinel Checks']},
{t:'Immutable infrastructure and drift',s:'Replace, do not patch.',
 a:'Build a new image and replace servers. Detect drift with a scheduled plan, then revert or adopt the change deliberately.',
 w:'No hand-edited servers means reproducible environments.',see:[12,5,'Immutable Infrastructure: Image Baking and Replacement']}
]},

{h:'Security'},
{acc:[
{t:'Shift left',s:'Feedback at the point of change.',
 a:'Run each check at the earliest sensible stage: secrets and SCA on pull requests, image and IaC scans after build, DAST against a test environment.',
 w:'Gate on new findings so adoption is possible.',see:[13,0,'Shift-Left Security: What to Scan, When and Who Fixes']},
{t:'SBOM',s:'Inventory of components.',
 a:'A machine-readable list in SPDX or CycloneDX format. It answers which applications contain an affected component.',
 w:'Generate it from the built artifact and keep one per release.',
 c:`syft app:1.4.2 -o spdx-json > sbom.spdx.json`,see:[13,6,'SBOMs: Generating and Consuming SPDX and CycloneDX']},
{t:'Signing and verification',s:'Prove who built it.',
 a:'Keyless signing with Sigstore uses a short-lived certificate tied to an OIDC identity. Verify the signer identity and enforce at admission.',
 w:'Signing without enforcement changes nothing.',
 c:`cosign verify <image@digest> --certificate-identity-regexp <id> --certificate-oidc-issuer <issuer>`,see:[13,7,'Signing and Verifying Artifacts with Sigstore and cosign']},
{t:'SLSA provenance',s:'How it was built.',
 a:'Signed metadata describing source, builder and steps. Levels raise the cost of tampering.',
 w:'Valid provenance does not mean the code is safe.',see:[13,8,'SLSA Provenance and Its Limits']},
{t:'Secrets in pipelines',s:'Leak paths and defences.',
 a:'Secrets leak through logs, artifacts, images, forks and third-party code. Masking is a safety net, not a boundary.',
 w:'Untrusted code should never receive secrets.',see:[14,0,'Why Secrets Leak from Pipelines and How to Prevent It']},
{t:'Short-lived and dynamic credentials',s:'Nothing long-lived to steal.',
 a:'Use OIDC to cloud providers and dynamic secrets from Vault or cloud secret managers, authenticated with workload identity.',
 w:'A leaked credential expires on its own.',see:[14,3,'HashiCorp Vault and Cloud Secret Managers']}
]},

{h:'Operate'},
{acc:[
{t:'Metrics, logs and traces',s:'Three observability signals.',
 a:'Metrics alert and trend, logs explain events, traces show the path of a request.',
 w:'Use OpenTelemetry to avoid lock-in.',see:[15,0,'Observability Basics: Metrics, Logs and Traces']},
{t:'SLI, SLO and error budget',s:'Reliability as a number.',
 a:'The SLI is measured, the SLO is the target and the error budget is the allowed unreliability. Spend it on change.',
 w:'The budget settles velocity versus stability with data.',see:[15,2,'SLIs, SLOs and Error Budgets']},
{t:'Post-deployment verification',s:'Evidence the release is healthy.',
 a:'Compare health before and after a release and roll back automatically on regression.',
 w:'Confirm the new version is the one serving.',see:[15,5,'Post-Deployment Verification and Automated Rollback Triggers']},
{t:'Incident response and postmortems',s:'Mitigate first, learn after.',
 a:'Roles and severities organise the response. Postmortems are blameless and produce tracked actions.',
 w:'Learning needs safety and follow-through.',see:[15,6,'Incident Response: Roles, Severity and Communication']},
{t:'Platform as a product',s:'Owners, users and SLOs.',
 a:'Treat runners, templates and registries as a product with a roadmap, support and reliability targets. Golden paths make the safe way the easy way.',
 w:'Adoption is earned, not mandated.',see:[16,0,'Operating CI/CD as a Product: Reliability, SLOs and Ownership']},
{t:'Change evidence and separation of duties',s:'Controls as a side effect.',
 a:'Pipeline records answer who changed, who approved, what was tested and what was deployed. Authors cannot be the only approver.',
 w:'Automated evidence beats manual checklists.',see:[16,5,'Compliance, Audit Trails and Separation of Duties']}
]},
]},

{t:'Big-picture maps',d:'Four small maps of how the parts fit together: the delivery pipeline, GitOps, supply-chain trust and the platform.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Delivery pipeline'},
{map:{title:'Delivery pipeline map',h:216,trace:'Follow one change to production',
 hint:'Tap any box, or press Follow one change to production to see the path of a commit.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'src',x:21,y:24,w:194,h:56,c:'ext',t:'Source',s:'Git and pull request',d:'A change is proposed on a branch and reviewed. Protected main requires checks and approvals.',why:'Nothing bypasses review.',chk:`git log --oneline --graph`,see:[2,4,'Pull Requests and Merge Requests: Review, Status Checks and Required Approvals']},
 {id:'ci',x:243,y:24,w:194,h:56,c:'proc',t:'CI',s:'build and test',d:'Each commit is built and tested automatically in a clean environment.',why:'Fast feedback and a green main.',chk:`npm ci && npm test`,see:[3,0,'What Continuous Integration Is and Why Small Frequent Merges Matter']},
 {id:'art',x:465,y:24,w:194,h:56,c:'disk',t:'Artifact',s:'built once',d:'One immutable artifact or image is produced and stored by digest.',why:'The same bytes are promoted.',chk:`docker buildx imagetools inspect <image:tag>`,see:[8,0,'Artifact Management: Why Build Once and Promote']},
 {id:'gate',x:21,y:136,w:194,h:56,c:'warn',t:'Gates',s:'scan and sign',d:'Quality, security and policy checks block bad changes. The artifact is signed.',why:'Controls run on every change.',chk:`trivy image --exit-code 1 app:1.4.2`,see:[13,0,'Shift-Left Security: What to Scan, When and Who Fixes']},
 {id:'dep',x:243,y:136,w:194,h:56,c:'proc',t:'Deploy',s:'progressive rollout',d:'The artifact is released to environments with rolling, blue/green or canary strategies.',why:'Limit the blast radius.',chk:`kubectl rollout status deploy/app`,see:[10,5,'Canary Releases and Progressive Delivery']},
 {id:'obs',x:465,y:136,w:194,h:56,c:'mem',t:'Observe',s:'health and metrics',d:'Telemetry and verification confirm health and feed DORA metrics and incidents.',why:'Close the loop.',chk:`curl -fsS app/health`,see:[15,1,'Monitoring Deployments: Health Checks, Readiness and Smoke Verification']}],
 steps:[
 {ids:['src','ci'],t:'1. A reviewed change is merged and CI builds and tests it.',w:'Only verified code moves on.',s:'Branch protection.',x:'Failing tests ignored.',c:`npm test`},
 {ids:['art','gate'],t:'2. One artifact is produced, scanned and signed.',w:'Integrity and trust.',s:'Scan thresholds.',x:'Rebuilding per environment.',c:`cosign verify <image@digest>`},
 {ids:['dep','obs'],t:'3. The artifact is released gradually and observed.',w:'Fast detection and rollback.',s:'Rollout strategy.',x:'No post-deploy check.',c:`kubectl rollout status deploy/app`}]}},

{h:'2. GitOps'},
{map:{title:'GitOps map',h:216,trace:'Follow a desired-state change',
 hint:'Tap any box, or press Follow a desired-state change to see how Git drives the cluster.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'app',x:21,y:24,w:194,h:56,c:'ext',t:'App repository',s:'code',d:'CI builds and publishes the image from application code.',why:'Code and config change at different speeds.',chk:`git log -1`,see:[11,6,'Repository Structure: App Repo vs Config Repo and Environment Promotion']},
 {id:'ci',x:243,y:24,w:194,h:56,c:'proc',t:'CI job',s:'updates config',d:'After publishing, CI proposes a change to the image reference in the config repository.',why:'CI no longer holds cluster credentials.',chk:`git commit -m "bump image"`,see:[11,1,'Push vs Pull Deployment Models']},
 {id:'cfg',x:465,y:24,w:194,h:56,c:'disk',t:'Config repository',s:'desired state',d:'Manifests, Helm values or overlays per environment. The audit trail of what should run.',why:'Rollback is git revert.',chk:`git diff HEAD~1`,see:[11,2,'Kubernetes Manifests, Helm and Kustomize for Delivery']},
 {id:'agent',x:21,y:136,w:194,h:56,c:'proc',t:'GitOps agent',s:'Argo CD or Flux',d:'An in-cluster controller pulls the desired state and applies it continuously.',why:'Only needs read access to Git.',chk:`argocd app get sample-app`,see:[11,3,'Argo CD Architecture, Installation and Applications']},
 {id:'cl',x:243,y:136,w:194,h:56,c:'net',t:'Cluster',s:'actual state',d:'Live resources. Manual changes are detected as drift and corrected by self-heal.',why:'Declared state wins.',chk:`kubectl get deploy`,see:[11,4,'Syncing, Health, Drift and Self-Heal in Argo CD']},
 {id:'sec',x:465,y:136,w:194,h:56,c:'warn',t:'Secrets',s:'external reference',d:'Git holds only references to secrets, resolved by External Secrets, Sealed Secrets or SOPS.',why:'Plaintext secrets never enter Git.',chk:`kubectl get externalsecret`,see:[11,7,'Secrets in GitOps: Sealed Secrets, SOPS and External Secrets']}],
 steps:[
 {ids:['app','ci'],t:'1. CI publishes an image and opens a config change.',w:'Separate build from deploy.',s:'Image tag.',x:'Config loops.',c:`git push origin bump-image`},
 {ids:['cfg','agent'],t:'2. After review the agent pulls the new desired state.',w:'Pull model.',s:'Sync policy.',x:'Auto sync too eager.',c:`argocd app diff sample-app`},
 {ids:['cl','sec'],t:'3. The cluster converges and secrets are resolved externally.',w:'Declared state wins.',s:'selfHeal.',x:'Plain secrets in Git.',c:`argocd app get sample-app`}]}},

{h:'3. Supply chain trust'},
{map:{title:'Supply chain trust map',h:216,trace:'Follow trust from source to runtime',
 hint:'Tap any box, or press Follow trust from source to runtime to see where each control sits.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'src',x:21,y:24,w:194,h:56,c:'ext',t:'Source',s:'protected',d:'MFA, branch protection, review and signed commits protect what enters the build.',why:'Stolen credentials push code.',chk:`git config --get commit.gpgsign`,see:[13,1,'The Pipeline as an Attack Surface: A Threat Model']},
 {id:'dep',x:243,y:24,w:194,h:56,c:'mem',t:'Dependencies',s:'locked and scanned',d:'Lock files, internal proxy, SCA and update bots control third-party code.',why:'Most code is third-party.',chk:`npm audit --audit-level=high`,see:[13,3,'Dependency Scanning (SCA) and Automated Updates']},
 {id:'bld',x:465,y:24,w:194,h:56,c:'proc',t:'Build',s:'isolated',d:'Ephemeral runners, pinned actions and least-privilege tokens run the build.',why:'A poisoned build poisons everything.',chk:`actionlint`,see:[5,5,'Pinning Actions to Commit SHAs and Using Immutable Releases']},
 {id:'sbom',x:21,y:136,w:194,h:56,c:'disk',t:'SBOM and scan',s:'inventory',d:'The artifact is scanned and an SBOM is generated.',why:'Answer what is affected quickly.',chk:`syft <image> -o spdx-json`,see:[13,6,'SBOMs: Generating and Consuming SPDX and CycloneDX']},
 {id:'sig',x:243,y:136,w:194,h:56,c:'warn',t:'Sign and attest',s:'provenance',d:'The digest is signed keylessly and provenance is attached.',why:'Identity of the builder.',chk:`cosign sign --yes <image@digest>`,see:[13,7,'Signing and Verifying Artifacts with Sigstore and cosign']},
 {id:'adm',x:465,y:136,w:194,h:56,c:'net',t:'Verify at deploy',s:'admission policy',d:'The cluster rejects unsigned or unexpected images.',why:'Enforcement makes signing real.',chk:`cosign verify <image@digest> ...`,see:[13,8,'SLSA Provenance and Its Limits']}],
 steps:[
 {ids:['src','dep'],t:'1. Control what enters: source and dependencies.',w:'Prevent bad input.',s:'Branch rules, locks.',x:'Unpinned dependencies.',c:`npm audit`},
 {ids:['bld','sbom'],t:'2. Build in isolation, then scan and inventory.',w:'Know what you built.',s:'Scanner thresholds.',x:'Secrets in logs.',c:`trivy image <image>`},
 {ids:['sig','adm'],t:'3. Sign, attest and verify before running.',w:'End-to-end trust.',s:'Admission policy.',x:'Verifying existence only.',c:`cosign verify <image@digest>`}]}},

{h:'4. Platform'},
{map:{title:'Platform map',h:216,trace:'Follow a team onto the platform',
 hint:'Tap any box, or press Follow a team onto the platform to see what the platform provides.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'tpl',x:21,y:24,w:194,h:56,c:'proc',t:'Golden path',s:'templates',d:'Versioned reusable workflows and scaffolds with secure defaults.',why:'The safe way is the easy way.',chk:`uses: org/platform/.github/workflows/ci.yml@v3`,see:[16,1,'Pipeline Templates and Golden Paths']},
 {id:'run',x:243,y:24,w:194,h:56,c:'net',t:'Runners',s:'capacity',d:'Autoscaled ephemeral runners sized by queue time.',why:'Queue time is the key signal.',chk:`kubectl get pods -n arc-runners`,see:[16,2,'Scaling Runner Fleets: Capacity, Autoscaling and Queue Time']},
 {id:'id',x:465,y:24,w:194,h:56,c:'warn',t:'Identity',s:'OIDC and roles',d:'Per-pipeline narrow identities and short-lived credentials.',why:'Limit the blast radius.',chk:`aws sts get-caller-identity`,see:[14,5,'Least-Privilege Service Accounts and Deploy Identities']},
 {id:'gov',x:21,y:136,w:194,h:56,c:'ext',t:'Governance',s:'policy and audit',d:'Rulesets, required workflows, approvals and audit logs.',why:'Evidence as a side effect.',chk:`gh api orgs/<org>/rulesets`,see:[16,5,'Compliance, Audit Trails and Separation of Duties']},
 {id:'obs',x:243,y:136,w:194,h:56,c:'mem',t:'Pipeline observability',s:'metrics',d:'Success rate, duration, queue time and cost per team.',why:'Measure the system itself.',chk:`gh run list --limit 20`,see:[16,4,'Pipeline Observability: Failure Rates, Duration and Queue Metrics']},
 {id:'own',x:465,y:136,w:194,h:56,c:'disk',t:'Product ownership',s:'roadmap and SLOs',d:'A team owns the platform with support, documentation and SLOs.',why:'Adoption is earned.',chk:``,see:[16,0,'Operating CI/CD as a Product: Reliability, SLOs and Ownership']}],
 steps:[
 {ids:['tpl','run'],t:'1. A team adopts the template and gets runners.',w:'Paved path.',s:'Template version.',x:'Forks of the template.',c:`gh workflow list`},
 {ids:['id','gov'],t:'2. Identity and governance apply automatically.',w:'Consistent control.',s:'Rulesets.',x:'Over-broad roles.',c:`gh api orgs/<org>/rulesets`},
 {ids:['obs','own'],t:'3. The platform team measures and improves.',w:'Feedback loop.',s:'Dashboards.',x:'No owner.',c:`gh run list --limit 20`}]}},
]},

{t:'Process maps',d:'Five small maps of how something happens, step by step: a change to production, a canary, OIDC access, a pipeline diagnosis and a secret leak response.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Life of a change'},
{map:{title:'Life of a change',h:216,trace:'From commit to verified release',
 hint:'Tap any box, or press From commit to verified release to follow a change through the course path.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'c',x:21,y:24,w:194,h:56,c:'ext',t:'Commit and PR',s:'review',d:'A short-lived branch becomes a pull request with a description and linked work.',why:'Small and reviewable.',chk:`git push -u origin feature`,see:[2,4,'Pull Requests and Merge Requests: Review, Status Checks and Required Approvals']},
 {id:'ck',x:243,y:24,w:194,h:56,c:'proc',t:'Checks',s:'lint, test, scan',d:'Required status checks run. Failures block merge.',why:'Fast, cheap checks first.',chk:`gh pr checks`,see:[3,6,'Parallelism, Matrix Builds and Pipeline Speed']},
 {id:'m',x:465,y:24,w:194,h:56,c:'mem',t:'Merge',s:'to main',d:'Squash or rebase after approval. Main stays releasable.',why:'One method enforced.',chk:`git log -1`,see:[2,2,'Merge vs Rebase and Keeping History Clean']},
 {id:'b',x:21,y:136,w:194,h:56,c:'disk',t:'Build and publish',s:'by digest',d:'A single artifact is built, scanned, signed and stored.',why:'Immutable identity.',chk:`docker buildx imagetools inspect <image:tag>`,see:[8,0,'Artifact Management: Why Build Once and Promote']},
 {id:'d',x:243,y:136,w:194,h:56,c:'proc',t:'Deploy',s:'staging then prod',d:'Promotion by config change, with approvals where they add value.',why:'Same artifact, new config.',chk:`kubectl rollout status deploy/app`,see:[10,1,'Environments and Promotion: Dev, Test, Staging and Production']},
 {id:'v',x:465,y:136,w:194,h:56,c:'net',t:'Verify',s:'health and metrics',d:'Smoke tests and metrics confirm health or trigger rollback.',why:'Evidence, not hope.',chk:`curl -fsS app/health`,see:[15,5,'Post-Deployment Verification and Automated Rollback Triggers']}],
 steps:[
 {ids:['c','ck'],t:'1. The pull request runs required checks.',w:'Gate.',s:'Required checks.',x:'Optional checks.',c:`gh pr checks`},
 {ids:['m','b'],t:'2. Merge, then one artifact is built and signed.',w:'Trust.',s:'Build once.',x:'Rebuilt images.',c:`docker buildx imagetools inspect <image:tag>`},
 {ids:['d','v'],t:'3. Deploy by promotion and verify.',w:'Safe release.',s:'Strategy.',x:'No verification.',c:`kubectl rollout status deploy/app`}]}},

{h:'2. Canary with automatic rollback'},
{map:{title:'Canary with automatic rollback',h:216,trace:'From 5 percent to 100 percent',
 hint:'Tap any box, or press From 5 percent to 100 percent to follow the canary analysis.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'dep',x:21,y:24,w:194,h:56,c:'proc',t:'Deploy canary',s:'new version',d:'Start the new version next to the stable one with a small share.',why:'Limit exposure.',chk:`kubectl argo rollouts get rollout app`,see:[10,5,'Canary Releases and Progressive Delivery']},
 {id:'w5',x:243,y:24,w:194,h:56,c:'net',t:'Route 5 percent',s:'traffic split',d:'Weighted routing sends a small share of real traffic.',why:'Real users, small blast radius.',chk:`kubectl argo rollouts get rollout app -w`,see:[10,5,'Canary Releases and Progressive Delivery']},
 {id:'an',x:465,y:24,w:194,h:56,c:'mem',t:'Analyse',s:'error rate and latency',d:'Metrics for the canary are compared with thresholds or the baseline.',why:'Decide with data.',chk:`kubectl argo rollouts status app`,see:[15,5,'Post-Deployment Verification and Automated Rollback Triggers']},
 {id:'up',x:21,y:136,w:194,h:56,c:'proc',t:'Promote',s:'25, 50, 100',d:'If healthy, widen traffic in steps and finally promote.',why:'Gradual confidence.',chk:`kubectl argo rollouts promote app`,see:[10,5,'Canary Releases and Progressive Delivery']},
 {id:'rb',x:243,y:136,w:194,h:56,c:'warn',t:'Abort and roll back',s:'on regression',d:'A failed analysis returns all traffic to stable.',why:'Automatic safety.',chk:`kubectl argo rollouts abort app`,see:[10,8,'Rollbacks, Roll-Forward and Safe Database Changes']},
 {id:'pm',x:465,y:136,w:194,h:56,c:'ext',t:'Learn',s:'postmortem if needed',d:'Record what happened and update thresholds or tests.',why:'Improve.',chk:``,see:[15,7,'Blameless Postmortems and Learning']}],
 steps:[
 {ids:['dep','w5'],t:'1. Deploy and split a small share of traffic.',w:'Small blast radius.',s:'Weights.',x:'Too little traffic.',c:`kubectl argo rollouts get rollout app`},
 {ids:['an','up'],t:'2. Analyse then promote in steps.',w:'Evidence-driven.',s:'Success condition.',x:'Thresholds from guesses.',c:`kubectl argo rollouts promote app`},
 {ids:['rb','pm'],t:'3. On failure abort, restore and learn.',w:'Fast recovery.',s:'failureLimit.',x:'Unsafe rollback.',c:`kubectl argo rollouts abort app`}]}},

{h:'3. OIDC to a cloud'},
{map:{title:'OIDC to a cloud',h:216,trace:'Get temporary credentials',
 hint:'Tap any box, or press Get temporary credentials to follow identity federation.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'job',x:21,y:24,w:194,h:56,c:'proc',t:'Workflow job',s:'id-token: write',d:'The job requests an identity token for a chosen audience.',why:'Needs the permission.',chk:`gh run view`,see:[5,4,'OpenID Connect: Authenticating to Cloud Providers Without Stored Secrets']},
 {id:'idp',x:243,y:24,w:194,h:56,c:'ext',t:'Issuer',s:'GitHub or GitLab',d:'The platform signs a token with claims: repository, ref, environment.',why:'Claims describe the run.',chk:``,see:[14,2,'Short-Lived Credentials with OIDC for AWS, Azure and GCP']},
 {id:'trust',x:465,y:24,w:194,h:56,c:'warn',t:'Trust policy',s:'conditions',d:'The cloud checks signature, audience and subject against your rules.',why:'Without conditions any repo can assume it.',chk:`aws iam get-role --role-name gha-deploy`,see:[14,2,'Short-Lived Credentials with OIDC for AWS, Azure and GCP']},
 {id:'tok',x:21,y:136,w:194,h:56,c:'mem',t:'Temporary credentials',s:'minutes',d:'The cloud issues short-lived credentials for a scoped role.',why:'Nothing to rotate.',chk:`aws sts get-caller-identity`,see:[14,5,'Least-Privilege Service Accounts and Deploy Identities']},
 {id:'act',x:243,y:136,w:194,h:56,c:'proc',t:'Deploy action',s:'uses the role',d:'Steps use the credentials to deploy.',why:'Narrow permissions.',chk:`aws s3 ls`,see:[14,7,'Practical: Replace Stored Cloud Keys with OIDC and Vault']},
 {id:'exp',x:465,y:136,w:194,h:56,c:'disk',t:'Expiry',s:'automatic',d:'Credentials expire without cleanup.',why:'Leak window is small.',chk:``,see:[14,6,'Rotation and Revocation When a Secret Leaks']}],
 steps:[
 {ids:['job','idp'],t:'1. The job asks the platform for a signed token.',w:'Proof of identity.',s:'Audience.',x:'Missing permission.',c:`gh run view`},
 {ids:['trust','tok'],t:'2. The cloud verifies it against your trust policy.',w:'Authorisation.',s:'Subject claim.',x:'Wildcard subjects.',c:`aws iam get-role --role-name gha-deploy`},
 {ids:['act','exp'],t:'3. Credentials are used and expire.',w:'Least exposure.',s:'Duration.',x:'Role too broad.',c:`aws sts get-caller-identity`}]}},

{h:'4. Diagnosing a failing pipeline'},
{map:{title:'Diagnosing a failing pipeline',h:216,trace:'From red to root cause',
 hint:'Tap any box, or press From red to root cause to follow the troubleshooting method.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'obs',x:21,y:24,w:194,h:56,c:'ext',t:'Observe',s:'exact error',d:'Read the failing step and the lines just before the error.',why:'Evidence first.',chk:`gh run view --log-failed`,see:[17,5,'A Troubleshooting Method for Failing Pipelines']},
 {id:'cls',x:243,y:24,w:194,h:56,c:'mem',t:'Classify',s:'code, config, env, creds',d:'Decide which category the failure belongs to.',why:'Narrows the search.',chk:``,see:[17,5,'A Troubleshooting Method for Failing Pipelines']},
 {id:'cmp',x:465,y:24,w:194,h:56,c:'proc',t:'Compare',s:'to last green',d:'What changed in code, lock file, runner image or secrets?',why:'Most failures follow a change.',chk:`git log --oneline -10`,see:[4,9,'Workflow Commands, Job Summaries and Debugging Failed Runs']},
 {id:'rep',x:21,y:136,w:194,h:56,c:'net',t:'Reproduce',s:'locally or debug run',d:'Run the same command in the same image, or re-run with debug logging.',why:'A failure you can reproduce you can fix.',chk:`gh run rerun --failed --debug`,see:[1,6,'Practical: Run the Sample App\'s Build and Tests Locally']},
 {id:'fix',x:243,y:136,w:194,h:56,c:'proc',t:'Fix one thing',s:'test hypothesis',d:'Change one variable at a time and verify.',why:'Avoid shotgun changes.',chk:``,see:[17,5,'A Troubleshooting Method for Failing Pipelines']},
 {id:'grd',x:465,y:136,w:194,h:56,c:'warn',t:'Guard',s:'prevent recurrence',d:'Add a check, test or alert so it cannot return.',why:'Close the loop.',chk:``,see:[15,7,'Blameless Postmortems and Learning']}],
 steps:[
 {ids:['obs','cls'],t:'1. Read the exact error and classify it.',w:'Right problem.',s:'Log grouping.',x:'Reading only the red icon.',c:`gh run view --log-failed`},
 {ids:['cmp','rep'],t:'2. Compare with last green and reproduce.',w:'Isolate the change.',s:'Debug logging.',x:'Changing many things.',c:`git log --oneline -10`},
 {ids:['fix','grd'],t:'3. Fix, verify and guard.',w:'Durable fix.',s:'Tests and alerts.',x:'Fix without prevention.',c:`gh run rerun --failed`}]}},

{h:'5. Leaked secret response'},
{map:{title:'Leaked secret response',h:216,trace:'Revoke, investigate, rotate',
 hint:'Tap any box, or press Revoke, investigate, rotate to follow the response.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'det',x:21,y:24,w:194,h:56,c:'ext',t:'Detect',s:'scanner or report',d:'Secret scanning, push protection or a report finds the exposure.',why:'Time is critical.',chk:`gitleaks detect --source . --redact`,see:[13,2,'Secret Scanning and Push Protection']},
 {id:'rev',x:243,y:24,w:194,h:56,c:'warn',t:'Revoke',s:'immediately',d:'Disable the credential before investigating.',why:'Closes the risk.',chk:``,see:[14,6,'Rotation and Revocation When a Secret Leaks']},
 {id:'sco',x:465,y:24,w:194,h:56,c:'mem',t:'Scope',s:'what could it reach',d:'List systems, data and time window the credential allowed.',why:'Know the impact.',chk:``,see:[14,6,'Rotation and Revocation When a Secret Leaks']},
 {id:'aud',x:21,y:136,w:194,h:56,c:'net',t:'Audit use',s:'logs',d:'Look for use by anyone else.',why:'Detect misuse.',chk:``,see:[14,6,'Rotation and Revocation When a Secret Leaks']},
 {id:'rot',x:243,y:136,w:194,h:56,c:'proc',t:'Rotate',s:'and update consumers',d:'Issue a new secret and update every place it is used.',why:'Restores service.',chk:``,see:[14,3,'HashiCorp Vault and Cloud Secret Managers']},
 {id:'pre',x:465,y:136,w:194,h:56,c:'disk',t:'Prevent',s:'scan and short-lived',d:'Add rules and move to OIDC or dynamic credentials.',why:'Prevent recurrence.',chk:``,see:[14,2,'Short-Lived Credentials with OIDC for AWS, Azure and GCP']}],
 steps:[
 {ids:['det','rev'],t:'1. Detect and revoke at once.',w:'Close exposure.',s:'Alert routing.',x:'Waiting to investigate.',c:`gitleaks detect --source . --redact`},
 {ids:['sco','aud'],t:'2. Scope the reach and audit use.',w:'Know impact.',s:'Log retention.',x:'No audit logs.',c:`aws cloudtrail lookup-events`},
 {ids:['rot','pre'],t:'3. Rotate and prevent.',w:'Resilience.',s:'Automation.',x:'Untested rotation.',c:`gitleaks detect --source .`}]}},
]},

{t:'Commands by task',d:'The commands used most in delivery work, by task.',see:[[2,1,'Everyday Workflow: Clone, Branch, Commit, Push and Merge'],[4,9,'Workflow Commands, Job Summaries and Debugging Failed Runs']],b:[
{t:[['Task','Command'],['Branch and push','`git switch -c feature/x`, `git push -u origin feature/x`'],['Undo a shared commit','`git revert <sha>`'],['Tag a release','`git tag -a v1.5.0 -m "Release 1.5.0"` then `git push origin v1.5.0`'],['Install exact dependencies','`npm ci`, `pip install --require-hashes -r requirements.txt`'],['Build an image with cache','`docker buildx build --cache-from type=registry,ref=<ref> --cache-to type=registry,ref=<ref>,mode=max .`'],['Get an image digest','`docker buildx imagetools inspect <image:tag>`'],['Scan an image','`trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 <image>`'],['Generate an SBOM','`syft <image> -o spdx-json > sbom.json`'],['Sign and verify','`cosign sign --yes <image@digest>`, `cosign verify <image@digest> ...`'],['Scan for secrets','`gitleaks detect --source . --redact`'],['Lint a workflow','`actionlint`'],['GitHub run logs','`gh run list`, `gh run view <id> --log-failed`, `gh run rerun --failed`'],['Argo CD','`argocd app get`, `argocd app diff`, `argocd app sync`, `argocd app history`'],['Flux','`flux get all`, `flux reconcile kustomization <name>`'],['Rollout','`kubectl rollout status deploy/<name>`, `kubectl rollout undo deploy/<name>`'],['Terraform pipeline','`terraform fmt -check`, `terraform validate`, `terraform plan -input=false -out=tfplan`, `terraform apply tfplan`']]}
]},
{t:'Platform equivalents',d:'The same idea in GitHub Actions, GitLab CI/CD and Jenkins.',see:[[3,1,'Anatomy of a Pipeline: Triggers, Stages, Jobs, Steps and Runners']],b:[
{t:[['Concept','GitHub Actions','GitLab CI/CD','Jenkins'],['Definition file','`.github/workflows/*.yml`','`.gitlab-ci.yml`','`Jenkinsfile`'],['Trigger','`on:`','`rules`, pipeline source','Webhook, multibranch'],['Job runs on','`runs-on:` label','`tags:` and runner','`agent`, label'],['Order jobs','`needs:`','`stages:`, `needs:`','stages, `parallel`'],['Variables and secrets','`vars`, `secrets`, environments','CI/CD variables, protected, masked','Credentials, `withCredentials`'],['Reuse','Reusable workflows, composite actions','`include`, `extends`, components','Shared libraries'],['Artifacts','`upload-artifact`','`artifacts:`','`archiveArtifacts`'],['Cache','`actions/cache`','`cache:`','Plugins, agent caches'],['Approval gate','Environment required reviewers','Protected environments, manual jobs','`input` step'],['Cloud auth without keys','OIDC `id-token: write`','`id_tokens:`','OIDC plugin or workload identity']]}
]},
{t:'Deployment strategies compared',d:'Choose by downtime, cost and rollback.',see:[[10,3,'Rolling and Recreate Deployments'],[10,4,'Blue/Green Deployments'],[10,5,'Canary Releases and Progressive Delivery']],b:[
{t:[['Strategy','Downtime','Extra capacity','Rollback','Best for'],['Recreate','Yes','None','Redeploy previous','Incompatible versions, non-critical systems'],['Rolling','No','Small surge','Roll back gradually','Most stateless services'],['Blue/green','No','Double','Instant switch back','Fast cutover with validated environment'],['Canary','No','Small','Route traffic back','Risky changes needing real-traffic evidence'],['Feature flag','No','None','Flip the flag','Separating deploy from release']]}
]},
{t:'Troubleshooting lookup',d:'Symptom, likely cause and first step for common pipeline problems.',see:[[17,5,'A Troubleshooting Method for Failing Pipelines']],b:[
{t:[['Symptom','Likely cause','First step'],['Works locally, fails in CI','Different image, env or file case','Compare runner image and environment variables'],['Fails after a dependency change','Incompatible version','Check lock file diff, pin previous'],['Permission denied on push or deploy','Token scope or protected branch','Check job permissions and environment rules'],['Job waits forever','No runner matches labels','Check runner labels and status'],['Cannot pull image','Credentials or rate limit','Check registry login and token expiry'],['Required check pending forever','Path filter skipped the workflow','Add an aggregate job that always runs'],['Flaky test','Timing, order, shared state','Quarantine and reproduce in a loop'],['Secret appears in logs','Echo or debug output','Revoke, then remove the output'],['Argo CD OutOfSync after sync','Controller-managed fields','Use ignoreDifferences for those fields'],['Cache not hit','Key changes every run','Key on the lock file hash'],['Terraform apply blocked','State lock held','Check running applies before force-unlocking']]}
]},
]};
