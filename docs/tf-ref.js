/* LearnSphere - Terraform Quick Reference (cheat sheet).
   window.QREF['tf'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for Terraform 1.x (and OpenTofu where equivalent). Check the release notes for newer options. */
window.QREF=window.QREF||{};
window.QREF['tf']={title:'Terraform Quick Reference',blurb:'Commands, language blocks, files, environment variables and fixes for Terraform, plus maps of how it works, state, modules and everyday tasks.',hint:'force-unlock',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every Terraform user should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'How Terraform works'},
{acc:[
{t:'Declarative configuration',s:'You describe the end state.',
 a:'Terraform configuration (HCL) describes the resources you want. Terraform compares it with the **state** and the real infrastructure, builds a **plan** of changes and applies it. You do not write the steps.',
 w:'It makes changes reviewable and repeatable, and an unchanged configuration produces an empty plan.',
 c:`terraform plan -detailed-exitcode; echo exit=$?`,see:[0,1,'What is Infrastructure as Code: declarative vs imperative']},
{t:'Core, providers and state',s:'The three moving parts.',
 a:'**Terraform core** builds the graph and plan. **Providers** are plugins that talk to APIs (AWS, Azure, Kubernetes). The **state** records which real objects belong to which configuration.',
 w:'A problem is in the configuration, the provider\'s API call, or the state. Knowing which narrows it quickly.',
 c:`terraform version
terraform providers`,see:[0,3,'How Terraform works: core, providers, state and plan/apply']},
{t:'The core workflow',s:'init, plan, apply.',
 a:'`init` downloads providers and configures the backend, `plan` shows what will change, `apply` makes the change, `destroy` removes it. `fmt` and `validate` check the code first.',
 w:'Always read the plan. It is the review point.',
 c:`terraform init
terraform plan -out tfplan
terraform apply tfplan`,see:[2,0,'The core workflow: write, plan, apply']},
{t:'Reading a plan',s:'Symbols and what they mean.',
 a:'`+` create, `-` destroy, `~` update in place, `-/+` replace (destroy and create), `<=` read data. A **replace** of a database or disk is the line to look for.',
 w:'Most outages from Terraform are plans that were not read carefully.',
 c:`terraform plan | grep -E 'must be replaced|will be destroyed'`,see:[2,3,'terraform plan: reading the execution plan']},
{t:'Providers and versions',s:'Pin them.',
 a:'`required_providers` sets the source and version constraint. The **dependency lock file** `.terraform.lock.hcl` records exact versions and hashes. Commit it.',
 w:'An unpinned provider upgrade can change behaviour between two runs.',
 c:`terraform init -upgrade
cat .terraform.lock.hcl | head`,see:[3,2,'Providers: source addresses, versions and constraints']}
]},

{h:'Configuration language'},
{acc:[
{t:'Resources and data sources',s:'Manage versus read.',
 a:'A **resource** is created and managed. A **data source** reads something that already exists. Both are referenced as `type.name.attribute`.',
 w:'Use data sources for things you do not own, and resources for things you do.',
 c:`terraform state list
terraform state show aws_s3_bucket.logs`,see:[3,4,'Resources: arguments, attributes and addressing']},
{t:'Variables, locals and outputs',s:'Inputs, helpers and results.',
 a:'**Variables** are inputs (with type, default, validation and `sensitive`). **Locals** name an expression. **Outputs** expose values to the CLI and to parent modules.',
 w:'Keep environment differences in variable values, not in copies of code.',
 c:`terraform output
terraform plan -var-file=prod.tfvars`,see:[4,0,'Input variables: declaring, types and defaults']},
{t:'Variable precedence',s:'Which value wins.',
 a:'From lowest to highest: default, `terraform.tfvars`, `*.auto.tfvars`, `-var-file`, `-var`, and `TF_VAR_` environment variables are read alongside. Later sources override earlier ones.',
 w:'It explains "why is it using the wrong value".',
 c:`TF_VAR_region=eu-west-1 terraform plan`,see:[4,2,'Setting values: -var, .tfvars, TF_VAR_ and precedence']},
{t:'count and for_each',s:'Many from one.',
 a:'`count` makes numbered copies and is index-based: removing an item in the middle shifts the rest. `for_each` is keyed by map key or set value and is stable.',
 w:'Prefer `for_each` for sets of named things.',
 c:`terraform state list | grep 'aws_instance.web'`,see:[5,4,'for_each with maps and sets']},
{t:'Dynamic blocks and expressions',s:'Repeat nested blocks.',
 a:'`dynamic` generates repeated nested blocks from a collection. `for` expressions transform lists and maps. Use them sparingly: readability matters.',
 w:'Overuse makes a configuration hard to review.',
 c:`terraform console
> [for s in var.subnets : s.cidr]`,see:[5,6,'dynamic blocks']},
{t:'Dependencies and the graph',s:'Order from references.',
 a:'References create **implicit dependencies**. `depends_on` adds an explicit one when there is no reference. Terraform runs independent resources in parallel (default 10).',
 w:'Use `depends_on` rarely and explain why.',
 c:`terraform graph | dot -Tsvg > graph.svg`,see:[6,1,'The resource graph: order of operations']},
{t:'Lifecycle',s:'Control replacement.',
 a:'`create_before_destroy`, `prevent_destroy`, `ignore_changes` and `replace_triggered_by` change how updates happen. `precondition` and `postcondition` add checks.',
 w:'They protect databases and avoid noisy diffs, and they hide drift if overused.',
 c:`terraform plan -replace=aws_instance.web`,see:[6,2,'create_before_destroy and prevent_destroy']}
]},

{h:'State and backends'},
{acc:[
{t:'State file',s:'Terraform\'s memory.',
 a:'State maps configuration addresses to real object IDs and stores their attributes (including secrets in plain text). Without it, Terraform cannot tell what it manages.',
 w:'Protect it like a credential and never edit it by hand.',
 c:`terraform state list
terraform show -json | jq '.values.root_module.resources | length'`,see:[7,0,'Why Terraform needs state']},
{t:'Remote backends and locking',s:'Shared and safe.',
 a:'A **backend** stores state remotely (S3, azurerm, gcs, HCP Terraform) and **locks** it during writes so two runs cannot collide. A stuck lock can be released with `force-unlock` once you are sure.',
 w:'Local state on a laptop is a single point of failure.',
 c:`terraform init -migrate-state
terraform force-unlock <LOCK_ID>`,see:[7,2,'Remote backends: S3, azurerm, gcs and HCP Terraform']},
{t:'The state CLI',s:'Inspect and move.',
 a:'`state list`, `show`, `mv`, `rm` and `pull` inspect or change addresses without touching infrastructure. Prefer `moved` and `removed` blocks for refactors in code.',
 w:'Take a backup first (`state pull > backup.tfstate`).',
 c:`terraform state mv aws_instance.a aws_instance.b`,see:[7,5,'The state CLI: list, show, mv, rm and pull']},
{t:'Drift and refresh',s:'When reality changes.',
 a:'**Drift** is a difference between state and real infrastructure caused by changes outside Terraform. `plan -refresh-only` shows and records it without changing infrastructure.',
 w:'Detect drift on a schedule, and decide whether to adopt or revert.',
 c:`terraform plan -refresh-only`,see:[7,6,'Drift and refresh-only mode']},
{t:'Workspaces',s:'Several states, one configuration.',
 a:'CLI workspaces keep separate states for the same configuration. They share code and backend and are not a security boundary. Many teams prefer separate directories or HCP Terraform workspaces.',
 w:'Know the current workspace before apply.',
 c:`terraform workspace show
terraform workspace list`,see:[7,8,'CLI workspaces']}
]},

{h:'Modules, change and delivery'},
{acc:[
{t:'Modules',s:'Reusable building blocks.',
 a:'A module is a directory with inputs (variables), resources and outputs. The **root module** calls child modules by `source` and `version`. Registry modules should be version-pinned.',
 w:'Modules standardise patterns but add a layer to debug.',
 c:`terraform init
terraform providers`,see:[8,0,'What modules are: root and child modules']},
{t:'Importing existing infrastructure',s:'Bring resources under management.',
 a:'An `import` block (or `terraform import`) attaches an existing object to a resource address. `-generate-config-out` can draft the configuration. Review the plan until it shows no changes.',
 w:'It is how hand-built infrastructure is adopted safely.',
 c:`terraform plan -generate-config-out=generated.tf`,see:[9,0,'Importing existing infrastructure: the import block']},
{t:'Upgrading safely',s:'Terraform and providers.',
 a:'Read changelogs, upgrade one thing at a time, run `init -upgrade`, review the plan for unexpected replacements, and commit the lock file.',
 w:'Major provider versions can change defaults.',
 c:`terraform init -upgrade
terraform plan`,see:[9,4,'Upgrading Terraform and providers: lock file and -upgrade']},
{t:'Sensitive values and secrets',s:'State is not a vault.',
 a:'`sensitive = true` hides values in output but they remain in state. Use **ephemeral** values and write-only arguments where supported, and pull secrets from a secrets manager.',
 w:'Anyone who can read state can read the secrets in it.',
 c:`terraform state pull | grep -i password`,see:[10,1,'Marking values sensitive, and its limits']},
{t:'Testing and validation',s:'Check before apply.',
 a:'`fmt`, `validate`, linters (tflint), policy checks and `terraform test` with `.tftest.hcl` files verify code. Plan-only tests with mock providers are quick.',
 w:'Cheap checks in CI catch most mistakes.',
 c:`terraform fmt -check -recursive
terraform validate
terraform test`,see:[11,2,'terraform test: .tftest.hcl, run blocks and assertions']},
{t:'CI/CD',s:'Plan on pull request, apply on merge.',
 a:'Pipelines run `fmt`, `validate` and `plan` for each pull request, post the plan, and apply the saved plan after approval and merge. Use short-lived cloud credentials (OIDC).',
 w:'Humans review plans, machines apply them.',
 c:`terraform plan -input=false -out=tfplan
terraform apply -input=false tfplan`,see:[14,2,'CI/CD: plan on pull request, apply on merge']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Four small maps of how the parts fit together: how Terraform works, state and backends, modules and variables, and the dependency graph.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. How Terraform works'},
{map:{title:'Terraform architecture map',h:216,trace:'Plan and apply a change',
 hint:'Tap any box, or press Plan and apply a change to follow a configuration to real infrastructure.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'cfg',x:21,y:24,w:194,h:56,c:'ext',t:'Configuration',s:'*.tf files',d:'HCL files describing resources, variables and outputs.',why:'Format and validate it first.',chk:`terraform fmt -check && terraform validate`,see:[3,0,'HCL syntax: blocks, arguments and comments']},
 {id:'init',x:243,y:24,w:194,h:56,c:'proc',t:'terraform init',s:'providers and backend',d:'Downloads providers, modules and configures the backend, and writes the lock file.',why:'Run it again after changing providers.',chk:`terraform init`,see:[2,1,'terraform init']},
 {id:'core',x:465,y:24,w:194,h:56,c:'proc',t:'Terraform core',s:'graph and plan',d:'Reads configuration and state, builds the dependency graph and the plan.',why:'It does not call cloud APIs itself.',chk:`terraform plan`,see:[0,3,'How Terraform works']},
 {id:'state',x:21,y:136,w:194,h:56,c:'disk',t:'State',s:'what exists',d:'The record of managed objects and their attributes.',why:'Stored in the backend and locked during writes.',chk:`terraform state list`,see:[7,0,'Why Terraform needs state']},
 {id:'prov',x:243,y:136,w:194,h:56,c:'proc',t:'Provider plugin',s:'talks to the API',d:'Translates resource changes to API calls and reads current values.',why:'Authentication belongs here.',chk:`terraform providers`,see:[3,2,'Providers']},
 {id:'api',x:465,y:136,w:194,h:56,c:'ext',t:'Cloud API',s:'real infrastructure',d:'The service that creates the actual resources.',why:'Errors here are quota, permission and validation errors.',chk:`aws sts get-caller-identity`,see:[1,4,'Cloud credentials']}],
 steps:[
 {ids:['cfg','init'],t:'1. `init` prepares providers, modules and the backend.',w:'Nothing runs without it.',s:'Backend, lock file.',x:'Changed providers without init.',c:`terraform init`},
 {ids:['core','state'],t:'2. Core compares configuration, state and the real objects (refresh).',w:'The plan is the difference.',s:'Refresh option.',x:'Stale state.',c:`terraform plan`},
 {ids:['prov','api'],t:'3. On apply, providers call the API in dependency order.',w:'Parallel where independent.',s:'Parallelism.',x:'Quota or permission error.',c:`terraform apply`},
 {ids:['state'],t:'4. State is updated with the new attributes.',w:'The next plan starts from it.',s:'Locking.',x:'Apply interrupted before state write.',c:`terraform state list`}]}},

{h:'2. State and backends'},
{map:{title:'State map',h:216,trace:'Where state lives',
 hint:'Tap any box, or press Where state lives to see how state, backends and locks fit together.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'root',x:21,y:24,w:194,h:56,c:'ext',t:'Root module',s:'your configuration',d:'The directory where you run terraform.',why:'One root module has one state per workspace.',chk:`terraform workspace show`,see:[7,8,'CLI workspaces']},
 {id:'be',x:243,y:24,w:194,h:56,c:'proc',t:'Backend',s:'S3, azurerm, gcs, HCP',d:'Where state is stored and who may read and write it.',why:'Configure it in the terraform block.',chk:`terraform init -backend-config=prod.hcl`,see:[7,2,'Remote backends']},
 {id:'lock',x:465,y:24,w:194,h:56,c:'warn',t:'State lock',s:'one writer',d:'A lock prevents concurrent runs from corrupting state.',why:'Release a stuck lock only if no run is active.',chk:`terraform force-unlock <ID>`,see:[7,3,'State locking']},
 {id:'ws',x:21,y:136,w:194,h:56,c:'mem',t:'Workspace',s:'named state',d:'A separate state for the same configuration.',why:'Shares code and backend.',chk:`terraform workspace list`,see:[7,8,'CLI workspaces']},
 {id:'remote',x:243,y:136,w:194,h:56,c:'mem',t:'Remote state data',s:'read another state',d:'`terraform_remote_state` or outputs let one configuration read another\'s outputs.',why:'Couples stacks, use sparingly.',chk:`terraform output -json`,see:[7,7,'Refactoring: moved and removed blocks']},
 {id:'vers',x:465,y:136,w:194,h:56,c:'disk',t:'Versioning and backup',s:'recovery',d:'Bucket versioning and backups let you recover an earlier state.',why:'Enable them on the backend.',chk:`aws s3api list-object-versions --bucket tf-state`,see:[7,9,'Practical: Move state remote and detect drift']}],
 steps:[
 {ids:['root','be'],t:'1. The root module\'s backend setting decides where state is stored.',w:'Remote is shared and durable.',s:'Backend block.',x:'Local state in a team.',c:`terraform init`},
 {ids:['lock'],t:'2. Writing operations take a lock.',w:'One change at a time.',s:'Lock table or native lock.',x:'Stuck lock after a crashed run.',c:`terraform force-unlock <ID>`},
 {ids:['ws','vers'],t:'3. Workspaces and object versioning give separate and recoverable states.',w:'Recover from mistakes.',s:'Versioning.',x:'No versioning, lost state.',c:`aws s3api list-object-versions --bucket tf-state`}]}},

{h:'3. Modules and variables'},
{map:{title:'Module map',h:216,trace:'Data into and out of a module',
 hint:'Tap any box, or press Data into and out of a module to follow values through a root and a child module.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'tfv',x:21,y:24,w:194,h:56,c:'ext',t:'tfvars and environment',s:'inputs',d:'`-var-file`, `*.tfvars`, `TF_VAR_*` and `-var` set root variables.',why:'Precedence applies.',chk:`terraform console`,see:[4,2,'Setting values']},
 {id:'var',x:243,y:24,w:194,h:56,c:'mem',t:'Variables',s:'typed inputs',d:'Declared with type, default and validation.',why:'Validate early.',chk:`terraform validate`,see:[4,0,'Input variables']},
 {id:'root',x:465,y:24,w:194,h:56,c:'proc',t:'Root module',s:'calls the module',d:'Passes values to the child with `module` arguments, and chooses the version.',why:'Pin versions.',chk:`terraform get`,see:[8,1,'Module sources']},
 {id:'mod',x:21,y:136,w:194,h:56,c:'proc',t:'Child module',s:'reusable',d:'Contains resources, local values and outputs.',why:'Keep interfaces small.',chk:`terraform providers`,see:[8,5,'Writing your first module']},
 {id:'res',x:243,y:136,w:194,h:56,c:'disk',t:'Resources',s:'real objects',d:'Created from module inputs.',why:'Addresses include `module.<name>`.',chk:`terraform state list | grep module.`,see:[8,3,'Inputs, outputs and variable scope']},
 {id:'out',x:465,y:136,w:194,h:56,c:'mem',t:'Outputs',s:'results',d:'Exposed by the module and used by the parent or shown by the CLI.',why:'Mark secrets sensitive.',chk:`terraform output`,see:[4,5,'Output values']}],
 steps:[
 {ids:['tfv','var'],t:'1. Values arrive in root variables.',w:'One place per environment.',s:'Precedence.',x:'Wrong tfvars file.',c:`terraform plan -var-file=prod.tfvars`},
 {ids:['root','mod'],t:'2. The root passes values into the module call.',w:'The module sees only what is passed.',s:'Module arguments.',x:'Missing required variable.',c:`terraform validate`},
 {ids:['res','out'],t:'3. The module creates resources and returns outputs.',w:'Composition by outputs.',s:'Output blocks.',x:'Outputs that leak secrets.',c:`terraform output`}]}},

{h:'4. Dependency graph and lifecycle'},
{map:{title:'Graph and lifecycle map',h:216,trace:'Order and replacement',
 hint:'Tap any box, or press Order and replacement to see how Terraform orders changes and handles replacement.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'ref',x:21,y:24,w:194,h:56,c:'mem',t:'Reference',s:'implicit dependency',d:'Using `aws_subnet.a.id` makes the subnet a dependency.',why:'Prefer references.',chk:`terraform graph | head`,see:[6,0,'Implicit and explicit dependencies']},
 {id:'dep',x:243,y:24,w:194,h:56,c:'mem',t:'depends_on',s:'explicit',d:'Forces ordering when there is no reference.',why:'Use sparingly and comment why.',chk:`grep -n depends_on *.tf`,see:[6,0,'Implicit and explicit dependencies']},
 {id:'graph',x:465,y:24,w:194,h:56,c:'proc',t:'Resource graph',s:'parallel walk',d:'Terraform walks the graph, running independent nodes in parallel.',why:'Default parallelism is 10.',chk:`terraform apply -parallelism=5`,see:[6,1,'The resource graph']},
 {id:'cbd',x:21,y:136,w:194,h:56,c:'proc',t:'create_before_destroy',s:'no gap',d:'Create the replacement first, then remove the old one.',why:'Names must not clash.',chk:`terraform plan`,see:[6,2,'create_before_destroy and prevent_destroy']},
 {id:'ign',x:243,y:136,w:194,h:56,c:'warn',t:'ignore_changes',s:'skip attributes',d:'Stops Terraform reverting changes made elsewhere.',why:'Can hide real drift.',chk:`grep -n ignore_changes *.tf`,see:[6,3,'ignore_changes and replace_triggered_by']},
 {id:'prev',x:465,y:136,w:194,h:56,c:'warn',t:'prevent_destroy',s:'guard rail',d:'Fails any plan that would destroy the resource.',why:'Remove it deliberately to destroy.',chk:`terraform plan`,see:[6,2,'create_before_destroy and prevent_destroy']}],
 steps:[
 {ids:['ref','dep'],t:'1. References and depends_on define the order.',w:'Order from the code.',s:'Resources.',x:'Cycles.',c:`terraform graph`},
 {ids:['graph'],t:'2. The graph is walked, in parallel where possible.',w:'Fast applies.',s:'Parallelism.',x:'API rate limits.',c:`terraform apply -parallelism=5`},
 {ids:['cbd','ign','prev'],t:'3. Lifecycle rules shape what happens on change.',w:'Protect important resources.',s:'Lifecycle block.',x:'ignore_changes hides drift.',c:`terraform plan`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Five small maps of how something happens, step by step: a reviewed change, an import, an upgrade, drift handling and a lock or state recovery.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Reviewing and applying a change'},
{map:{title:'Change map',h:216,trace:'From edit to applied change',
 hint:'Tap any box, or press From edit to applied change to follow a safe change.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'edit',x:21,y:24,w:194,h:56,c:'ext',t:'Edit',s:'branch',d:'Change the configuration on a branch.',why:'One change at a time.',chk:`git switch -c change-sg`,see:[9,3,'Making changes safely: plan review, targeting and rollback']},
 {id:'fmt',x:243,y:24,w:194,h:56,c:'mem',t:'fmt and validate',s:'quick checks',d:'Format and validate before planning.',why:'Fails fast.',chk:`terraform fmt -check -recursive && terraform validate`,see:[2,2,'terraform fmt and terraform validate']},
 {id:'plan',x:465,y:24,w:194,h:56,c:'proc',t:'Plan',s:'saved plan',d:'Produce a plan and save it with `-out`.',why:'Apply exactly what was reviewed.',chk:`terraform plan -out tfplan`,see:[2,3,'terraform plan']},
 {id:'rev',x:21,y:136,w:194,h:56,c:'warn',t:'Review',s:'look for replace',d:'Read for destroys, replacements and unexpected changes.',why:'A replace of data is the danger.',chk:`terraform show tfplan | grep -E 'replace|destroy'`,see:[2,3,'terraform plan']},
 {id:'apply',x:243,y:136,w:194,h:56,c:'proc',t:'Apply',s:'saved plan',d:'Apply the saved plan.',why:'No new prompt, no new changes.',chk:`terraform apply tfplan`,see:[2,4,'terraform apply']},
 {id:'chk',x:465,y:136,w:194,h:56,c:'mem',t:'Verify',s:'no drift',d:'A second plan should be empty.',why:'Record outputs.',chk:`terraform plan -detailed-exitcode`,see:[2,4,'terraform apply']}],
 steps:[
 {ids:['edit','fmt'],t:'1. Change the code and run formatting and validation.',w:'Catch mistakes.',s:'Pre-commit hooks.',x:'Skipping checks.',c:`terraform validate`},
 {ids:['plan','rev'],t:'2. Plan to a file and read it carefully.',w:'Review is the control.',s:'Plan output.',x:'Not reading replaces.',c:`terraform show tfplan`},
 {ids:['apply','chk'],t:'3. Apply the saved plan, then confirm a clean plan.',w:'Proof it worked.',s:'Exit code.',x:'Remaining diff points to a bug.',c:`terraform plan -detailed-exitcode`}]}},

{h:'2. Importing a hand-built resource'},
{map:{title:'Import map',h:216,trace:'Adopt an existing resource',
 hint:'Tap any box, or press Adopt an existing resource to follow an import.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'find',x:21,y:24,w:194,h:56,c:'ext',t:'Find the ID',s:'from the console or CLI',d:'Identify the real object and its import ID format from the provider docs.',why:'Formats differ by resource.',chk:`aws ec2 describe-security-groups --group-ids sg-0123`,see:[9,0,'Importing existing infrastructure']},
 {id:'blk',x:243,y:24,w:194,h:56,c:'proc',t:'import block',s:'to and id',d:'Declare an `import` block with the target address and ID.',why:'Reviewed in the plan.',chk:`terraform plan`,see:[9,0,'Importing existing infrastructure']},
 {id:'gen',x:465,y:24,w:194,h:56,c:'proc',t:'Generate config',s:'draft code',d:'Use `-generate-config-out` to draft the resource block.',why:'Drafts need cleanup.',chk:`terraform plan -generate-config-out=generated.tf`,see:[9,1,'Generating configuration with -generate-config-out']},
 {id:'plan',x:21,y:136,w:194,h:56,c:'mem',t:'Plan until clean',s:'no changes',d:'Adjust the configuration until the plan shows only the import.',why:'Do not accept unwanted changes.',chk:`terraform plan`,see:[9,3,'Making changes safely']},
 {id:'adj',x:243,y:136,w:194,h:56,c:'warn',t:'Adjust arguments',s:'match reality',d:'Match arguments to the real object, or decide on deliberate changes.',why:'Computed fields are ignored.',chk:`terraform show`,see:[9,3,'Making changes safely']},
 {id:'done',x:465,y:136,w:194,h:56,c:'disk',t:'Apply and remove',s:'state updated',d:'Apply, then delete the import block.',why:'Commit the result.',chk:`terraform apply`,see:[9,0,'Importing existing infrastructure']}],
 steps:[
 {ids:['find','blk'],t:'1. Find the ID and declare the import.',w:'Terraform will attach it.',s:'ID format.',x:'Wrong ID.',c:`terraform plan`},
 {ids:['gen','plan'],t:'2. Generate or write the configuration and plan until it is clean.',w:'No hidden changes.',s:'Arguments.',x:'A plan that replaces the resource.',c:`terraform plan`},
 {ids:['done'],t:'3. Apply to write the state, then remove the block.',w:'Under management.',s:'State.',x:'Forgetting to commit.',c:`terraform state list`}]}},

{h:'3. Upgrading Terraform and providers'},
{map:{title:'Upgrade map',h:216,trace:'Upgrade without surprises',
 hint:'Tap any box, or press Upgrade without surprises to follow an upgrade.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'read',x:21,y:24,w:194,h:56,c:'mem',t:'Read the changelog',s:'breaking changes',d:'Check release notes and upgrade guides.',why:'Major versions change defaults.',chk:`terraform version`,see:[9,5,'Handling breaking changes: provider major versions and deprecations']},
 {id:'pin',x:243,y:24,w:194,h:56,c:'mem',t:'Pin the new version',s:'constraint',d:'Update `required_version` or `required_providers`.',why:'One at a time.',chk:`grep -n version *.tf`,see:[3,2,'Providers']},
 {id:'up',x:465,y:24,w:194,h:56,c:'proc',t:'init -upgrade',s:'update lock',d:'Upgrade providers within the constraint and update the lock file.',why:'Review the lock file diff.',chk:`terraform init -upgrade`,see:[9,4,'Upgrading Terraform and providers']},
 {id:'plan',x:21,y:136,w:194,h:56,c:'proc',t:'Plan',s:'expect no changes',d:'A pure upgrade should plan no changes.',why:'Investigate any diff.',chk:`terraform plan`,see:[9,4,'Upgrading Terraform and providers']},
 {id:'rep',x:243,y:136,w:194,h:56,c:'warn',t:'Unexpected replace',s:'stop',d:'Do not apply replacements of data stores you did not intend.',why:'Pin back and investigate.',chk:`terraform plan | grep replaced`,see:[9,5,'Handling breaking changes']},
 {id:'lock',x:465,y:136,w:194,h:56,c:'disk',t:'Commit the lock file',s:'reproducible',d:'The lock file makes every machine use the same versions.',why:'Include multiple platforms.',chk:`terraform providers lock -platform=linux_amd64 -platform=darwin_arm64`,see:[3,2,'Providers']}],
 steps:[
 {ids:['read','pin'],t:'1. Read the notes and change one version constraint.',w:'Small steps.',s:'Constraint.',x:'Upgrading everything at once.',c:`terraform version`},
 {ids:['up','plan'],t:'2. Run `init -upgrade` and plan.',w:'Expect an empty plan.',s:'Lock file.',x:'Unexpected diffs.',c:`terraform plan`},
 {ids:['rep','lock'],t:'3. Resolve any replacement, then commit the lock file.',w:'Same versions for the team.',s:'Platforms.',x:'Lock file missing hashes.',c:`git diff .terraform.lock.hcl`}]}},

{h:'4. Detecting and handling drift'},
{map:{title:'Drift map',h:216,trace:'Find and resolve drift',
 hint:'Tap any box, or press Find and resolve drift to follow a drift check.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'sch',x:126,y:24,w:200,h:56,c:'ext',t:'Scheduled plan',s:'detect',d:'A scheduled job runs `plan -detailed-exitcode`. Exit code 2 means changes exist.',why:'Alert on 2.',chk:`terraform plan -detailed-exitcode`,see:[14,4,'Scheduled plans and drift alerts']},
 {id:'ref',x:354,y:24,w:200,h:56,c:'proc',t:'Refresh-only plan',s:'see the drift',d:'`-refresh-only` shows what changed outside Terraform without proposing code changes.',why:'It updates state only if applied.',chk:`terraform plan -refresh-only`,see:[7,6,'Drift and refresh-only mode']},
 {id:'dec',x:21,y:136,w:194,h:56,c:'mem',t:'Decide',s:'adopt or revert',d:'Was the change intended? Adopt it in code, or revert it with apply.',why:'Ask who changed it.',chk:`terraform plan`,see:[7,6,'Drift and refresh-only mode']},
 {id:'adopt',x:243,y:136,w:194,h:56,c:'proc',t:'Adopt in code',s:'edit and refresh',d:'Update the configuration, then apply a refresh-only plan to update state.',why:'Keep history.',chk:`terraform apply -refresh-only`,see:[7,6,'Drift and refresh-only mode']},
 {id:'rev',x:465,y:136,w:194,h:56,c:'warn',t:'Revert',s:'apply',d:'Apply the configuration to bring infrastructure back.',why:'Check for impact first.',chk:`terraform apply`,see:[2,4,'terraform apply']}],
 steps:[
 {ids:['sch','ref'],t:'1. A scheduled plan detects a difference.',w:'Early warning.',s:'Schedule.',x:'Nobody reads the alerts.',c:`terraform plan -detailed-exitcode`},
 {ids:['dec'],t:'2. Decide whether the change was intended.',w:'A people question.',s:'Process.',x:'Overwriting an emergency fix.',c:`terraform plan -refresh-only`},
 {ids:['adopt','rev'],t:'3. Adopt it in code, or revert with an apply.',w:'State and code agree.',s:'Review.',x:'Missing the cause.',c:`terraform plan`}]}},

{h:'5. Recovering from a stuck lock or lost state'},
{map:{title:'Recovery map',h:216,trace:'Unlock and restore state',
 hint:'Tap any box, or press Unlock and restore state to follow a recovery.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'err',x:126,y:24,w:200,h:56,c:'warn',t:'Lock error',s:'state locked',d:'A run failed or was interrupted and left the lock.',why:'The error shows the lock ID and who holds it.',chk:`terraform plan`,see:[11,6,'Common errors: auth, locks, cycles, providers and quotas']},
 {id:'chk',x:354,y:24,w:200,h:56,c:'mem',t:'Check for active runs',s:'pipelines and people',d:'Make sure no run is still active before releasing the lock.',why:'Releasing during a run corrupts state.',chk:`ps -ef | grep terraform`,see:[7,3,'State locking']},
 {id:'unl',x:21,y:136,w:194,h:56,c:'proc',t:'force-unlock',s:'release',d:'Release the lock with the ID.',why:'Last resort.',chk:`terraform force-unlock <LOCK_ID>`,see:[7,3,'State locking']},
 {id:'ver',x:243,y:136,w:194,h:56,c:'disk',t:'Versioned backups',s:'previous state',d:'If state is damaged, restore a previous object version from the backend.',why:'Needs versioning enabled.',chk:`aws s3api list-object-versions --bucket tf-state --prefix prod/terraform.tfstate`,see:[7,9,'Practical: Move state remote and detect drift']},
 {id:'rest',x:465,y:136,w:194,h:56,c:'proc',t:'Restore and plan',s:'verify',d:'Restore the version and run a plan to confirm it matches reality.',why:'Import anything missing.',chk:`terraform plan`,see:[7,5,'The state CLI']}],
 steps:[
 {ids:['err','chk'],t:'1. Read the lock error and confirm nothing is running.',w:'Safety first.',s:'Runner status.',x:'Unlocking a live run.',c:`terraform plan`},
 {ids:['unl'],t:'2. Release the lock with force-unlock.',w:'State writable again.',s:'Lock ID.',x:'Wrong ID.',c:`terraform force-unlock <LOCK_ID>`},
 {ids:['ver','rest'],t:'3. If state is bad, restore a version and plan.',w:'Recover.',s:'Backups.',x:'No versioning.',c:`terraform plan`}]}},

]},

{t:'CLI commands',d:'The Terraform commands and options used most, by task.',see:[[2,0,'The core workflow: write, plan, apply'],[2,6,'Inspecting with show, output, console and graph']],b:[
{t:[['Task','Command'],['Initialise','`terraform init`, `terraform init -upgrade`, `terraform init -migrate-state`'],['Format and validate','`terraform fmt -recursive`, `terraform validate`'],['Plan to a file','`terraform plan -out tfplan`, `terraform plan -var-file=prod.tfvars`'],['Apply a saved plan','`terraform apply tfplan`'],['Destroy','`terraform destroy`, `terraform plan -destroy`'],['Replace one resource','`terraform apply -replace=aws_instance.web`'],['Target (exceptional)','`terraform apply -target=module.net`'],['Drift','`terraform plan -refresh-only`, `terraform apply -refresh-only`'],['State','`terraform state list|show|mv|rm|pull`'],['Outputs and show','`terraform output -json`, `terraform show tfplan`'],['Console','`terraform console`'],['Workspaces','`terraform workspace list|new|select|show`'],['Test','`terraform test`'],['Debug logging','`TF_LOG=DEBUG TF_LOG_PATH=tf.log terraform plan`'],['Version and completion','`terraform version`, `terraform -install-autocomplete`'],['Variables','`-var "name=value"`, `-var-file=prod.tfvars`, `TF_VAR_name=value`'],['Non-interactive runs','`-input=false`, `-no-color`, `-lock-timeout=60s`, `-parallelism=20`'],['Backend settings','`terraform init -backend-config=backend.hcl`, `terraform init -reconfigure`'],['Import','`terraform import aws_s3_bucket.logs my-bucket`, `terraform plan -generate-config-out=generated.tf`'],['Unlock stuck state','`terraform force-unlock <lock-id>`'],['Providers and lock file','`terraform providers`, `terraform providers lock -platform=linux_amd64 -platform=darwin_arm64`'],['Modules','`terraform get -update`'],['One output value','`terraform output -raw <name>`'],['Format check for CI','`terraform fmt -check -diff -recursive`'],['Dependency graph','`terraform graph | dot -Tsvg > graph.svg`'],['Cloud login','`terraform login`, `terraform logout`'],['Tools around Terraform','`tflint`, `terraform-docs markdown .`, `checkov -d .`, `trivy config .`, `infracost breakdown --path .`']]}
]},
{t:'Language reference',d:'Blocks, meta-arguments and common functions.',see:[[3,0,'HCL syntax: blocks, arguments and comments'],[5,1,'Functions: string, numeric and collection']],b:[
{t:[['Block','Purpose'],['`terraform`','Required version, providers and backend'],['`provider`','Configure a provider, with aliases'],['`resource`','A managed object'],['`data`','Read an existing object'],['`variable`','Input with type, default and validation'],['`locals`','Named expressions'],['`output`','Exposed values'],['`module`','Call a module'],['`import`, `moved`, `removed`','Adopt, rename and forget resources in code'],['`check`','Assertions that warn']]},
{t:[['Meta-argument','Effect'],['`count`','Number of instances, index-based'],['`for_each`','Instances keyed by map or set'],['`depends_on`','Explicit ordering'],['`provider`','Select a provider alias'],['`lifecycle`','Replacement and protection rules']]},
{t:[['Function','Use'],['`merge`, `concat`, `flatten`','Combine collections'],['`lookup`, `try`, `coalesce`','Safe access and defaults'],['`format`, `join`, `split`','Strings'],['`cidrsubnet`','Calculate subnets'],['`templatefile`','Render a template']]}
]},
{t:'Files, variables and environment',d:'Files Terraform reads and writes, and the environment variables you will meet.',see:[[1,5,'CLI configuration: .terraformrc, TF_* environment variables and the plugin cache'],[4,2,'Setting values: -var, .tfvars, TF_VAR_ and precedence']],b:[
{t:[['Item','Meaning'],['`*.tf`','Configuration'],['`terraform.tfvars`, `*.auto.tfvars`','Variable values loaded automatically'],['`.terraform/`','Downloaded providers and modules (do not commit)'],['`.terraform.lock.hcl`','Provider versions and hashes (commit)'],['`terraform.tfstate`','Local state (do not commit)'],['`TF_LOG`, `TF_LOG_PATH`','Logging level and file'],['`TF_VAR_<name>`','Set an input variable'],['`TF_INPUT=0`','Never prompt (CI)'],['`TF_CLI_ARGS`','Default CLI arguments'],['`TF_PLUGIN_CACHE_DIR`','Shared provider cache'],['`.terraformrc`','CLI configuration and mirrors']]}
]},
{t:'Troubleshooting lookup',d:'Symptom, likely cause and first step for common Terraform problems.',see:[[11,5,'A troubleshooting workflow for Terraform'],[11,6,'Common errors: auth, locks, cycles, providers and quotas']],b:[
{t:[['Symptom','Likely cause','First step'],['Error acquiring the state lock','Another run, or a crashed run','Check for active runs, then `force-unlock`'],['No valid credential sources','Provider authentication missing','Check profile and environment variables'],['Provider produced inconsistent result','Provider bug or eventual consistency','Retry, upgrade the provider'],['Cycle','Circular references','`terraform graph`, break the dependency'],['Plan shows replacement unexpectedly','Immutable argument changed','Read the `# forces replacement` line'],['Resource already exists','Created outside Terraform','Import it'],['Backend configuration changed','Backend block edited','`terraform init -reconfigure` or `-migrate-state`'],['Provider version conflicts','Lock file or constraints','`terraform init -upgrade`'],['Plan is slow','Large state, many refreshes','`-refresh=false` for investigation, split state'],['Quota or rate limit errors','Cloud limits','Lower `-parallelism`, request quota'],['Secrets in state','Normal behaviour','Restrict backend access, use ephemeral values']]}
]},
]};
