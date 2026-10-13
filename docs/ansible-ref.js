/* LearnSphere - Ansible Quick Reference (cheat sheet).
   window.QREF['ansible'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for ansible-core 2.16+ and current collections. Check module options with ansible-doc. */
window.QREF=window.QREF||{};
window.QREF['ansible']={title:'Ansible Quick Reference',blurb:'Commands, project layout, modules and fixes for Ansible, plus maps of the architecture, variables, reuse, AWX and everyday tasks.',hint:'unreachable',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every Ansible user should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Foundations'},
{acc:[
{t:'Agentless and push-based',s:'Nothing to install on managed nodes.',
 a:'Ansible runs on a **control node** and connects to **managed nodes** over SSH (WinRM for Windows). It copies small module programs, runs them and removes them. Managed nodes only need Python and SSH.',
 w:'No agent to patch, and any host you can SSH into is manageable.',
 c:`ansible all -m ping`,see:[0,2,'What Ansible is: agentless, push-based and declarative']},
{t:'Idempotency and desired state',s:'Run it again and nothing changes.',
 a:'A well-written task describes a state (a package present, a file with this content). If the host is already in that state the task reports **ok**, not **changed**.',
 w:'It lets you run playbooks repeatedly and use `--check` to see drift.',
 c:`ansible-playbook site.yml --check --diff`,see:[0,5,'Idempotency and desired state with a small example']},
{t:'Inventory',s:'Which hosts, in which groups.',
 a:'An inventory lists hosts and **groups** (INI, YAML or dynamic plugins). Variables attach to hosts and groups through `group_vars` and `host_vars`.',
 w:'Targeting and variables both start here.',
 c:`ansible-inventory --graph
ansible-inventory --host web1`,see:[2,0,'Static inventory: INI and YAML formats']},
{t:'Patterns and limits',s:'Choose who a run touches.',
 a:'Patterns select hosts: `web`, `web:db`, `web:&prod`, `all:!db`. `--limit` narrows a playbook run further.',
 w:'Always know the target set before running against production.',
 c:`ansible-playbook site.yml --limit web1 --list-hosts`,see:[2,3,'Patterns: wildcards, unions, intersections, exclusions and --limit']},
{t:'Configuration and ansible.cfg',s:'Where defaults come from.',
 a:'Ansible reads `ANSIBLE_CONFIG`, `./ansible.cfg`, `~/.ansible.cfg` and `/etc/ansible/ansible.cfg` in that order. `ansible-config dump --only-changed` shows what is set.',
 w:'A surprising `ansible.cfg` explains many odd behaviours.',
 c:`ansible-config dump --only-changed`,see:[1,4,'Configuration files: ansible.cfg, search order and ansible-config']}
]},

{h:'Playbooks and variables'},
{acc:[
{t:'Plays, tasks and modules',s:'The structure of a playbook.',
 a:'A **playbook** is a list of **plays**. Each play targets hosts and runs **tasks**, each calling a **module** with arguments. Tasks run in order on each host, in parallel across hosts (forks).',
 w:'Prefer a module over `command` or `shell` so the task is idempotent.',
 c:`ansible-playbook site.yml --syntax-check`,see:[4,1,'Anatomy of a playbook: plays, hosts, tasks and modules']},
{t:'Handlers',s:'Do it only when something changed.',
 a:'A task `notify`s a **handler**, which runs once at the end of the play (or on `meta: flush_handlers`) if any notifying task changed something.',
 w:'Restart a service only when its config actually changed.',
 c:`ansible-playbook site.yml -v | grep -i handler`,see:[4,3,'Handlers: notify, flush and when they run']},
{t:'Variable precedence',s:'Which value wins.',
 a:'There are 22 levels. In practice: role defaults are lowest, then inventory and `group_vars`, `host_vars`, play vars, role vars, task vars, and **extra vars (`-e`) always win**.',
 w:'Put defaults in `defaults/`, and avoid defining the same variable in many places.',
 c:`ansible web1 -m debug -a 'var=nginx_port'`,see:[5,1,'Variable precedence: which value wins']},
{t:'Facts',s:'What Ansible learns about a host.',
 a:'`gather_facts` runs the `setup` module and fills `ansible_facts` (OS, network, memory). Facts can be cached, disabled for speed, or extended with custom facts.',
 w:'Use facts for conditionals, but disable them when not needed.',
 c:`ansible web1 -m setup -a 'filter=ansible_distribution*'`,see:[5,2,'Facts: gathered, custom and cached']},
{t:'Jinja2 and templates',s:'Dynamic files.',
 a:'Jinja2 expressions `{{ var }}`, filters (`| default`, `| to_nice_json`) and tests drive variables and the `template` module renders configuration files from them.',
 w:'Render, then validate, then reload.',
 c:`ansible-playbook site.yml --check --diff`,see:[5,4,'Jinja2 essentials: expressions, filters and tests']},
{t:'Conditionals, loops and blocks',s:'Control flow.',
 a:'`when` conditions, `loop` (with `loop_control`), and `block`/`rescue`/`always` for error handling. `changed_when` and `failed_when` define results for commands.',
 w:'These make command-based tasks behave like idempotent modules.',
 c:`ansible-playbook site.yml -v`,see:[6,0,'Conditionals with when']}
]},

{h:'Roles, collections and reuse'},
{acc:[
{t:'Roles',s:'Reusable units.',
 a:'A role has a fixed layout (`tasks`, `handlers`, `defaults`, `vars`, `templates`, `files`, `meta`). Used with `roles:` or `include_role`. `defaults/` is the public interface and `vars/` internal.',
 w:'Roles make playbooks short and let you share and test code.',
 c:`ansible-galaxy role init webserver`,see:[7,1,'Role directory layout: tasks, handlers, defaults, vars, templates, files and meta']},
{t:'Collections and FQCN',s:'Content packaged and namespaced.',
 a:'A **collection** bundles modules, plugins and roles under a namespace. Use fully qualified collection names (`ansible.builtin.copy`). Pin versions in `requirements.yml`.',
 w:'FQCN removes ambiguity, and pinning makes runs reproducible.',
 c:`ansible-galaxy collection install -r requirements.yml
ansible-galaxy collection list`,see:[8,0,'From modules to collections: namespaces and FQCN']},
{t:'Plugins',s:'Extend Ansible itself.',
 a:'Plugin types include connection, callback, filter, lookup and inventory plugins. Modules run on the target, plugins run on the control node.',
 w:'A filter or lookup is often simpler than a custom module.',
 c:`ansible-doc -t lookup -l | head`,see:[8,3,'Plugin types: connection, callback, filter, lookup and inventory']},
{t:'ansible-vault',s:'Encrypt secrets in the repository.',
 a:'`ansible-vault` encrypts files or single values. Use vault IDs for several environments, and `no_log: true` to keep secrets out of output.',
 w:'Never commit a plain-text secret or the vault password.',
 c:`ansible-vault encrypt_string 'S3cret' --name db_password`,see:[9,0,'Ansible Vault: encrypting files and variables']}
]},

{h:'Operations and scale'},
{acc:[
{t:'Privilege escalation',s:'become.',
 a:'`become: true` runs a task as another user (root by default) with `sudo` or another method. Keep the SSH user unprivileged and limit sudo rules.',
 w:'Many "permission denied" errors are `become` settings.',
 c:`ansible web -b -m command -a 'id'`,see:[3,5,'Privilege escalation with become']},
{t:'Rolling updates',s:'serial and delegation.',
 a:'`serial` runs a play on batches of hosts, `max_fail_percentage` stops it when too many fail, and `delegate_to` runs a task elsewhere (a load balancer). `run_once` runs it on one host.',
 w:'It is how you update a fleet without taking it down.',
 c:`ansible-playbook deploy.yml -e serial=1`,see:[6,6,'Rolling updates: serial, max_fail_percentage and strategies']},
{t:'Check mode and diff',s:'Preview changes.',
 a:'`--check` simulates changes and `--diff` shows file differences. Tasks that cannot simulate (command, shell) are skipped unless marked `check_mode: false`.',
 w:'Use it in CI and before production changes.',
 c:`ansible-playbook site.yml --check --diff`,see:[3,7,'Check mode and diff: previewing changes before you make them']},
{t:'Testing and linting',s:'Quality gates.',
 a:'`ansible-lint` and `yamllint` catch style and risky patterns. **Molecule** creates test instances, converges a role, checks idempotence and verifies results.',
 w:'Run lint in every pull request and Molecule for shared roles.',
 c:`ansible-lint
molecule test`,see:[11,0,'Linting with ansible-lint and yamllint']},
{t:'AWX and Automation Platform',s:'Central control.',
 a:'AWX (upstream of Automation Platform) provides a web UI, API, RBAC, credentials, job templates, workflows and scheduling, running jobs in **execution environments** (container images).',
 w:'It removes shared SSH keys and gives an audit trail.',
 c:`awx job_templates list`,see:[12,0,'AWX and Automation Platform: architecture and components']},
{t:'Debugging',s:'-v to -vvvv.',
 a:'`-v` shows results, `-vvv` shows connection details, `-vvvv` shows SSH commands. The `debug` module prints variables, and the playbook debugger can pause on failure.',
 w:'Increase verbosity one step at a time.',
 c:`ansible-playbook site.yml -vvv --limit web1`,see:[13,0,'Debugging: -v to -vvvv, the debug module and the playbook debugger']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Four small maps of how the parts fit together: the architecture, variables and precedence, roles and collections, and AWX.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Architecture'},
{map:{title:'Architecture map',h:216,trace:'Run a task on a host',
 hint:'Tap any box, or press Run a task on a host to follow one task from the control node to a managed node.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'inv',x:21,y:24,w:194,h:56,c:'ext',t:'Inventory',s:'hosts and groups',d:'Lists the managed nodes and the groups and variables that apply to them.',why:'A pattern selects from it.',chk:`ansible-inventory --graph`,see:[2,0,'Static inventory']},
 {id:'play',x:243,y:24,w:194,h:56,c:'proc',t:'Playbook',s:'plays and tasks',d:'Describes what to apply to which group of hosts.',why:'Syntax check before running.',chk:`ansible-playbook site.yml --syntax-check`,see:[4,1,'Anatomy of a playbook']},
 {id:'mod',x:465,y:24,w:194,h:56,c:'proc',t:'Module',s:'unit of work',d:'A small program that makes one thing true, such as a package present.',why:'Prefer modules over shell.',chk:`ansible-doc ansible.builtin.package`,see:[3,0,'Ad-hoc command anatomy: pattern, module and arguments']},
 {id:'ssh',x:21,y:136,w:194,h:56,c:'net',t:'SSH connection',s:'connection plugin',d:'The control node connects, copies the module and arguments.',why:'Keys and user from inventory or config.',chk:`ssh -v user@host`,see:[1,2,'Preparing managed nodes: Python, SSH keys and a service account']},
 {id:'py',x:243,y:136,w:194,h:56,c:'mem',t:'Python on the target',s:'runs the module',d:'The module executes with the target\'s Python and returns JSON.',why:'Interpreter discovery matters.',chk:`ansible web1 -m setup -a 'filter=ansible_python*'`,see:[13,1,'Common failures: SSH, Python interpreter, become and encoding']},
 {id:'res',x:465,y:136,w:194,h:56,c:'mem',t:'Result',s:'ok, changed, failed',d:'The JSON result is shown and used by handlers, `register` and `when`.',why:'Changed triggers handlers.',chk:`ansible-playbook site.yml -v`,see:[5,3,'Registered variables and set_fact']}],
 steps:[
 {ids:['inv','play'],t:'1. The play selects hosts from the inventory and loads their variables.',w:'The target set is exact.',s:'Patterns, limits.',x:'Wrong group.',c:`ansible-playbook site.yml --list-hosts`},
 {ids:['mod','ssh'],t:'2. For each task, Ansible connects by SSH and sends the module.',w:'Parallel up to forks.',s:'forks, connection.',x:'Unreachable host.',c:`ansible all -m ping`},
 {ids:['py','res'],t:'3. The module runs with Python and returns a result.',w:'ok, changed or failed.',s:'Interpreter.',x:'Missing Python.',c:`ansible-playbook site.yml -v`}]}},

{h:'2. Variables and precedence'},
{map:{title:'Variable map',h:328,trace:'Where a value comes from',
 hint:'Tap any box, or press Where a value comes from to follow a value through its sources.',
 lines:[[326,52,352,52],'M454 80 L454 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'dflt',x:126,y:24,w:200,h:56,c:'mem',t:'Role defaults',s:'lowest',d:'`defaults/main.yml` is the weakest source and the role\'s public interface.',why:'Override from anywhere.',chk:`ansible-doc -t role`,see:[7,4,'defaults vs vars: designing a role interface']},
 {id:'inv',x:354,y:24,w:200,h:56,c:'mem',t:'Inventory vars',s:'group_vars, host_vars',d:'Values attached to groups and hosts. Host overrides group.',why:'Child groups override parents.',chk:`ansible-inventory --host web1`,see:[2,2,'Host and group variables: group_vars and host_vars']},
 {id:'play',x:126,y:136,w:200,h:56,c:'mem',t:'Play and task vars',s:'vars, vars_files',d:'Variables defined in the playbook for a play or task.',why:'Higher than inventory.',chk:`ansible-playbook site.yml -e @vars.yml`,see:[5,0,'Defining and using variables']},
 {id:'role',x:354,y:136,w:200,h:56,c:'mem',t:'Role vars',s:'vars/main.yml',d:'Internal role constants. They override play vars.',why:'Do not use for tunable values.',chk:`grep -R vars/ roles`,see:[7,4,'defaults vs vars']},
 {id:'ext',x:354,y:248,w:200,h:56,c:'warn',t:'Extra vars',s:'-e, highest',d:'Always wins over every other source.',why:'Use for one-off overrides.',chk:`ansible-playbook site.yml -e env=prod`,see:[5,1,'Variable precedence']},
 {id:'fact',x:126,y:248,w:200,h:56,c:'mem',t:'Facts and registered',s:'runtime values',d:'Gathered facts and `register` results are created while the play runs.',why:'Facts rank high.',chk:`ansible web1 -m setup`,see:[5,2,'Facts']}],
 steps:[
 {ids:['dflt','inv'],t:'1. A role supplies defaults and inventory overrides them.',w:'Environment-specific values.',s:'group_vars.',x:'Same name in many files.',c:`ansible-inventory --host web1`},
 {ids:['play','role'],t:'2. Play and role vars override inventory.',w:'Local wins.',s:'Placement.',x:'Surprising overrides.',c:`ansible web1 -m debug -a 'var=port'`},
 {ids:['fact','ext'],t:'3. Facts and extra vars sit at the top.',w:'Extra vars decide.',s:'-e.',x:'A forgotten -e in CI.',c:`ansible-playbook site.yml -e port=8080`}]}},

{h:'3. Roles and collections'},
{map:{title:'Reuse map',h:216,trace:'How content is packaged',
 hint:'Tap any box, or press How content is packaged to see roles, collections and requirements.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'req',x:21,y:24,w:194,h:56,c:'ext',t:'requirements.yml',s:'pinned content',d:'Lists roles and collections with versions.',why:'Commit it.',chk:`ansible-galaxy install -r requirements.yml`,see:[7,6,'Ansible Galaxy: finding, installing and requirements.yml']},
 {id:'gal',x:243,y:24,w:194,h:56,c:'ext',t:'Galaxy and Automation Hub',s:'sources',d:'Public and private sources of content.',why:'Vet content before use.',chk:`ansible-galaxy collection install community.general`,see:[7,6,'Ansible Galaxy']},
 {id:'col',x:465,y:24,w:194,h:56,c:'proc',t:'Collection',s:'namespace.name',d:'Modules, plugins and roles with a namespace.',why:'Use FQCN.',chk:`ansible-galaxy collection list`,see:[8,1,'Installing and pinning collections']},
 {id:'role',x:21,y:136,w:194,h:56,c:'proc',t:'Role',s:'tasks and defaults',d:'A directory layout with tasks, defaults and templates.',why:'Keep defaults documented.',chk:`ansible-galaxy role init app`,see:[7,1,'Role directory layout']},
 {id:'task',x:243,y:136,w:194,h:56,c:'mem',t:'Tasks and handlers',s:'the work',d:'The role\'s tasks call modules from collections.',why:'Tag tasks.',chk:`ansible-playbook site.yml --tags config`,see:[4,4,'Tags: running part of a playbook']},
 {id:'tmpl',x:465,y:136,w:194,h:56,c:'disk',t:'Templates and files',s:'content',d:'Jinja2 templates and static files shipped with the role.',why:'Validate rendered files.',chk:`ansible-playbook site.yml --check --diff`,see:[5,5,'The template module']}],
 steps:[
 {ids:['req','gal'],t:'1. Requirements name roles and collections and their versions.',w:'Reproducible.',s:'requirements.yml.',x:'Unpinned versions.',c:`ansible-galaxy install -r requirements.yml`},
 {ids:['col','role'],t:'2. Roles use modules from the collections.',w:'FQCN avoids ambiguity.',s:'Namespace.',x:'Short names clash.',c:`ansible-galaxy collection list`},
 {ids:['task','tmpl'],t:'3. Tasks apply templates and files to the hosts.',w:'The result on the node.',s:'Templates.',x:'Untested templates.',c:`ansible-playbook site.yml --check --diff`}]}},

{h:'4. AWX and the platform'},
{map:{title:'AWX map',h:216,trace:'Launch a job template',
 hint:'Tap any box, or press Launch a job template to follow an AWX job.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'prj',x:21,y:24,w:194,h:56,c:'ext',t:'Project',s:'playbooks in Git',d:'A source control repository that AWX syncs.',why:'Use branches or tags.',chk:`awx projects list`,see:[12,1,'Projects, inventories, credentials and job templates']},
 {id:'inv',x:243,y:24,w:194,h:56,c:'mem',t:'Inventory',s:'hosts',d:'Static or synced from cloud sources.',why:'Source of truth.',chk:`awx inventories list`,see:[12,1,'Projects, inventories, credentials and job templates']},
 {id:'cred',x:465,y:24,w:194,h:56,c:'warn',t:'Credential',s:'stored secret',d:'SSH keys, tokens and vault passwords stored encrypted and never shown.',why:'Scope by RBAC.',chk:`awx credentials list`,see:[12,1,'Projects, inventories, credentials and job templates']},
 {id:'jt',x:21,y:136,w:194,h:56,c:'proc',t:'Job template',s:'what to run',d:'Combines project, playbook, inventory and credentials with options.',why:'Surveys collect variables.',chk:`awx job_templates launch 7`,see:[12,1,'Projects, inventories, credentials and job templates']},
 {id:'ee',x:243,y:136,w:194,h:56,c:'proc',t:'Execution environment',s:'container image',d:'The container with Ansible, collections and Python dependencies the job runs in.',why:'Build and version it.',chk:`ansible-navigator images`,see:[12,4,'Execution environments and automation mesh']},
 {id:'node',x:465,y:136,w:194,h:56,c:'net',t:'Managed nodes',s:'targets',d:'Hosts the job connects to over SSH or WinRM.',why:'Reachable from the execution node.',chk:`awx jobs list`,see:[12,0,'AWX and Automation Platform']}],
 steps:[
 {ids:['prj','inv'],t:'1. The job uses a project and an inventory.',w:'Code and targets.',s:'Sync.',x:'Out-of-date project.',c:`awx projects list`},
 {ids:['cred','jt'],t:'2. A job template combines them with credentials.',w:'Secrets stay in AWX.',s:'RBAC.',x:'Over-broad credentials.',c:`awx job_templates list`},
 {ids:['ee','node'],t:'3. The job runs in an execution environment and reaches the nodes.',w:'Reproducible runs.',s:'EE image.',x:'Missing collection in the EE.',c:`awx jobs list`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Five small maps of how something happens, step by step: a playbook run, a rolling deploy, Vault, a failing task and role testing in CI.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. Life of a playbook run'},
{map:{title:'Playbook run map',h:216,trace:'From command to result',
 hint:'Tap any box, or press From command to result to follow a playbook execution.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'parse',x:21,y:24,w:194,h:56,c:'mem',t:'Parse',s:'playbook and config',d:'Read ansible.cfg, the playbook and imports.',why:'Syntax errors stop here.',chk:`ansible-playbook site.yml --syntax-check`,see:[4,2,'Running playbooks']},
 {id:'inv',x:243,y:24,w:194,h:56,c:'mem',t:'Select hosts',s:'inventory and limit',d:'Build the host list and variables for each play.',why:'Check with --list-hosts.',chk:`ansible-playbook site.yml --list-hosts`,see:[2,3,'Patterns']},
 {id:'fact',x:465,y:24,w:194,h:56,c:'proc',t:'Gather facts',s:'setup',d:'Run the setup module on each host if enabled.',why:'Disable if unused.',chk:`ansible-playbook site.yml -e gather_facts=false`,see:[5,2,'Facts']},
 {id:'task',x:21,y:136,w:194,h:56,c:'proc',t:'Run tasks',s:'in order',d:'Each task runs on all hosts in the batch before the next task (linear strategy).',why:'Failures remove the host.',chk:`ansible-playbook site.yml -v`,see:[4,1,'Anatomy of a playbook']},
 {id:'hand',x:243,y:136,w:194,h:56,c:'proc',t:'Handlers',s:'end of play',d:'Notified handlers run once after the tasks.',why:'Flush when needed.',chk:`ansible-playbook site.yml -v`,see:[4,3,'Handlers']},
 {id:'rec',x:465,y:136,w:194,h:56,c:'mem',t:'Recap',s:'ok changed failed',d:'A summary per host: ok, changed, unreachable, failed, skipped.',why:'A second run should show changed=0.',chk:`ansible-playbook site.yml | tail -20`,see:[4,2,'Running playbooks']}],
 steps:[
 {ids:['parse','inv'],t:'1. Parse the playbook and select the hosts.',w:'Fix syntax early.',s:'Limit.',x:'Wrong target set.',c:`ansible-playbook site.yml --list-hosts`},
 {ids:['fact','task'],t:'2. Gather facts, then run the tasks in order.',w:'Per-host results.',s:'forks, strategy.',x:'Unreachable host.',c:`ansible-playbook site.yml -v`},
 {ids:['hand','rec'],t:'3. Run handlers and print the recap.',w:'A clear result.',s:'Handlers.',x:'Changed on every run.',c:`ansible-playbook site.yml | tail`}]}},

{h:'2. Zero-downtime rolling deploy'},
{map:{title:'Rolling deploy map',h:328,trace:'Update a fleet in batches',
 hint:'Tap any box, or press Update a fleet in batches to follow a rolling deployment.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L340 219 L340 246'],
 nodes:[
 {id:'ser',x:126,y:24,w:200,h:56,c:'proc',t:'serial',s:'batch size',d:'Process hosts in batches, such as 1 then 25 percent.',why:'Start small.',chk:`ansible-playbook deploy.yml`,see:[6,6,'Rolling updates']},
 {id:'out',x:354,y:24,w:200,h:56,c:'ext',t:'Take out of the pool',s:'delegate_to',d:'Remove the host from the load balancer using `delegate_to`.',why:'Drain connections first.',chk:`ansible-playbook deploy.yml --tags drain`,see:[6,5,'Delegation: delegate_to, run_once and local_action']},
 {id:'dep',x:21,y:136,w:194,h:56,c:'proc',t:'Deploy',s:'update',d:'Install the new version and restart.',why:'Handlers restart once.',chk:`ansible-playbook deploy.yml --tags app`,see:[6,7,'Practical: Zero-downtime rolling deploy']},
 {id:'hc',x:243,y:136,w:194,h:56,c:'mem',t:'Health check',s:'wait_for',d:'Wait for the port or URL and verify.',why:'Retries with `until`.',chk:`ansible web1 -m uri -a 'url=http://localhost/health'`,see:[6,4,'Retries and waiting']},
 {id:'in',x:465,y:136,w:194,h:56,c:'ext',t:'Return to pool',s:'enable again',d:'Add the host back to the load balancer.',why:'Only after health passes.',chk:`ansible-playbook deploy.yml --tags enable`,see:[6,5,'Delegation']},
 {id:'stop',x:240,y:248,w:200,h:56,c:'warn',t:'Stop on failure',s:'max_fail_percentage',d:'Abort the run when failures exceed the limit.',why:'Protects the fleet.',chk:`grep max_fail deploy.yml`,see:[6,6,'Rolling updates']}],
 steps:[
 {ids:['ser','out'],t:'1. Select a batch and remove it from the pool.',w:'Capacity stays up.',s:'serial.',x:'Batch too large.',c:`ansible-playbook deploy.yml --list-hosts`},
 {ids:['dep','hc'],t:'2. Deploy and wait for the health check.',w:'Verify before continuing.',s:'Retries.',x:'No health check.',c:`ansible web1 -m uri -a 'url=http://localhost/health'`},
 {ids:['in','stop'],t:'3. Return the host, or stop if too many fail.',w:'Contain the damage.',s:'max_fail_percentage.',x:'No failure limit.',c:`ansible-playbook deploy.yml`}]}},

{h:'3. Using Vault for secrets'},
{map:{title:'Vault map',h:216,trace:'Encrypt, use and rotate a secret',
 hint:'Tap any box, or press Encrypt, use and rotate a secret to follow a secret through its life.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'enc',x:126,y:24,w:200,h:56,c:'proc',t:'Encrypt',s:'ansible-vault',d:'Encrypt a file or a single value.',why:'Use vault IDs for environments.',chk:`ansible-vault encrypt group_vars/prod/vault.yml`,see:[9,0,'Ansible Vault']},
 {id:'store',x:354,y:24,w:200,h:56,c:'disk',t:'Commit',s:'in Git',d:'The encrypted file is committed. The password is not.',why:'Keep the password in a secrets manager.',chk:`git add group_vars/prod/vault.yml`,see:[9,1,'Vault IDs, password files and multiple environments']},
 {id:'run',x:21,y:136,w:194,h:56,c:'proc',t:'Use at run time',s:'vault password',d:'Provide the password with a file or script.',why:'CI supplies it as a secret.',chk:`ansible-playbook site.yml --vault-id prod@~/.vault_prod`,see:[9,1,'Vault IDs, password files and multiple environments']},
 {id:'nolog',x:243,y:136,w:194,h:56,c:'warn',t:'no_log',s:'keep out of output',d:'Prevent tasks from printing secrets in logs.',why:'Also applies to loops.',chk:`grep -R no_log roles`,see:[9,2,'Protecting output: no_log and safe logging']},
 {id:'rot',x:465,y:136,w:194,h:56,c:'mem',t:'Rotate',s:'rekey',d:'Change the vault password or the secret.',why:'Plan access for CI.',chk:`ansible-vault rekey group_vars/prod/vault.yml`,see:[9,1,'Vault IDs, password files and multiple environments']}],
 steps:[
 {ids:['enc','store'],t:'1. Encrypt the secret and commit the encrypted file.',w:'Safe in Git.',s:'Vault ID.',x:'Committing a plain file.',c:`head -1 group_vars/prod/vault.yml`},
 {ids:['run','nolog'],t:'2. Provide the password at run time and keep output clean.',w:'No leaks in logs.',s:'no_log.',x:'Secrets in debug output.',c:`ansible-playbook site.yml --vault-id prod@prompt`},
 {ids:['rot'],t:'3. Rotate on a schedule or after exposure.',w:'Limit exposure.',s:'Rekey.',x:'Old password in CI.',c:`ansible-vault rekey ...`}]}},

{h:'4. Diagnosing a failing task'},
{map:{title:'Failure map',h:328,trace:'Unreachable or failed',
 hint:'Tap any box, or press Unreachable or failed to follow the checks.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'rec',x:21,y:24,w:194,h:56,c:'mem',t:'Read the recap',s:'which host and task',d:'Find the first failure and its host.',why:'Later failures are often consequences.',chk:`ansible-playbook site.yml | tail -30`,see:[13,0,'Debugging: -v to -vvvv']},
 {id:'un',x:243,y:24,w:194,h:56,c:'warn',t:'UNREACHABLE',s:'connection',d:'SSH problem: network, key, user or host key.',why:'Test with a ping module and ssh.',chk:`ansible web1 -m ping -vvv`,see:[13,1,'Common failures: SSH, Python interpreter, become and encoding']},
 {id:'fail',x:465,y:24,w:194,h:56,c:'warn',t:'FAILED',s:'task error',d:'The module ran and returned an error.',why:'Read the msg and stderr.',chk:`ansible-playbook site.yml -v --limit web1`,see:[13,1,'Common failures']},
 {id:'ssh',x:21,y:136,w:194,h:56,c:'net',t:'SSH',s:'keys and user',d:'Check the user, key and known_hosts.',why:'Use `-vvvv` for the SSH command.',chk:`ansible web1 -m ping -vvvv`,see:[1,2,'Preparing managed nodes']},
 {id:'py',x:243,y:136,w:194,h:56,c:'mem',t:'Python',s:'interpreter',d:'A missing or wrong interpreter fails modules.',why:'Set `ansible_python_interpreter`.',chk:`ansible web1 -m raw -a 'which python3'`,see:[13,1,'Common failures']},
 {id:'bec',x:465,y:136,w:194,h:56,c:'warn',t:'become',s:'privileges',d:'Missing sudo rights or password.',why:'Check sudoers.',chk:`ansible web1 -b -m command -a id`,see:[3,5,'Privilege escalation with become']},
 {id:'vvv',x:126,y:248,w:200,h:56,c:'mem',t:'Verbosity',s:'-vvv',d:'More detail on connection and module arguments.',why:'Increase gradually.',chk:`ansible-playbook site.yml -vvv --limit web1`,see:[13,0,'Debugging']},
 {id:'fix',x:354,y:248,w:200,h:56,c:'proc',t:'Fix and rerun',s:'limit to the host',d:'Apply one fix and rerun against the single host.',why:'Then run the whole group.',chk:`ansible-playbook site.yml --limit web1`,see:[13,0,'Debugging']}],
 steps:[
 {ids:['rec','un'],t:'1. Read the recap and decide: unreachable or failed.',w:'Two different families.',s:'Output.',x:'Fixing the wrong host.',c:`ansible-playbook site.yml | tail`},
 {ids:['ssh','py'],t:'2. For unreachable, test SSH and Python.',w:'Connection first.',s:'User, key.',x:'Wrong user.',c:`ansible web1 -m ping -vvvv`},
 {ids:['fail','bec'],t:'3. For failed, read the message and check become.',w:'Module-level error.',s:'become.',x:'No sudo.',c:`ansible web1 -b -m command -a id`},
 {ids:['vvv','fix'],t:'4. Use verbosity, fix one thing, rerun with a limit.',w:'Safe iteration.',s:'Limit.',x:'Changing many things.',c:`ansible-playbook site.yml --limit web1`}]}},

{h:'5. Testing a role in CI'},
{map:{title:'CI map',h:216,trace:'Lint, test and release a role',
 hint:'Tap any box, or press Lint, test and release a role to follow a CI pipeline.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'lint',x:126,y:24,w:200,h:56,c:'mem',t:'Lint',s:'ansible-lint, yamllint',d:'Check style and risky patterns.',why:'Fail the build.',chk:`ansible-lint`,see:[11,0,'Linting with ansible-lint and yamllint']},
 {id:'syn',x:354,y:24,w:200,h:56,c:'mem',t:'Syntax check',s:'playbook',d:'Verify the playbooks parse.',why:'Fast.',chk:`ansible-playbook site.yml --syntax-check`,see:[4,2,'Running playbooks']},
 {id:'mol',x:21,y:136,w:194,h:56,c:'proc',t:'Molecule converge',s:'test instance',d:'Create an instance and apply the role.',why:'Use containers for speed.',chk:`molecule converge`,see:[11,2,'Testing roles with Molecule']},
 {id:'idem',x:243,y:136,w:194,h:56,c:'warn',t:'Idempotence',s:'second run',d:'Run again and require zero changes.',why:'Finds non-idempotent tasks.',chk:`molecule idempotence`,see:[11,1,'Dry runs: --check, --diff and idempotence tests']},
 {id:'rel',x:465,y:136,w:194,h:56,c:'ext',t:'Release',s:'tag and publish',d:'Tag a version and publish to Galaxy or a private hub.',why:'Semantic versions.',chk:`git tag v1.2.0`,see:[11,5,'Releases and promotion across environments']}],
 steps:[
 {ids:['lint','syn'],t:'1. Lint and syntax check on every pull request.',w:'Cheap and quick.',s:'Rules.',x:'Ignoring warnings.',c:`ansible-lint`},
 {ids:['mol','idem'],t:'2. Converge in a test instance and check idempotence.',w:'Real behaviour.',s:'Scenario.',x:'Slow scenarios.',c:`molecule test`},
 {ids:['rel'],t:'3. Tag and release the tested version.',w:'Reproducible.',s:'Version policy.',x:'Untagged consumption.',c:`git tag v1.2.0`}]}},

]},

{t:'Commands by task',d:'The Ansible commands used most, by task.',see:[[3,0,'Ad-hoc command anatomy: pattern, module and arguments'],[4,2,'Running playbooks: ansible-playbook, limits, verbosity and syntax check']],b:[
{t:[['Task','Command'],['Test connectivity','`ansible all -m ping`'],['Ad hoc command','`ansible web -b -m ansible.builtin.package -a \'name=nginx state=present\'`'],['Run a playbook','`ansible-playbook site.yml -i inventory/prod --limit web1`'],['Dry run','`ansible-playbook site.yml --check --diff`'],['Syntax and hosts','`--syntax-check`, `--list-hosts`, `--list-tasks`'],['Run some tags','`--tags config`, `--skip-tags slow`'],['Verbosity','`-v`, `-vv`, `-vvv`, `-vvvv`'],['Extra variables','`-e env=prod`, `-e @vars.yml`'],['Inventory','`ansible-inventory --graph`, `--list`, `--host <name>`'],['Facts','`ansible web1 -m setup`'],['Documentation','`ansible-doc ansible.builtin.copy`'],['Vault','`ansible-vault create|edit|encrypt|decrypt|rekey|encrypt_string`'],['Galaxy','`ansible-galaxy collection install -r requirements.yml`'],['Config','`ansible-config dump --only-changed`']]}
]},
{t:'Files and directories',d:'The project layout and the files Ansible reads.',see:[[11,3,'Project layout and version control conventions'],[7,1,'Role directory layout: tasks, handlers, defaults, vars, templates, files and meta']],b:[
{t:[['Path','Contains'],['`ansible.cfg`','Project configuration'],['`inventory/`','Inventory files and dynamic inventory config'],['`group_vars/`, `host_vars/`','Variables per group and host'],['`site.yml`','Main playbook'],['`roles/<name>/tasks/main.yml`','Role tasks'],['`roles/<name>/defaults/main.yml`','Role default variables'],['`roles/<name>/handlers/main.yml`','Role handlers'],['`roles/<name>/templates/`','Jinja2 templates'],['`requirements.yml`','Roles and collections to install'],['`~/.ansible/`','Collections cache, temporary files and facts cache']]}
]},
{t:'Troubleshooting lookup',d:'Symptom, likely cause and first step for common Ansible problems.',see:[[13,1,'Common failures: SSH, Python interpreter, become and encoding'],[13,2,'Slow playbooks: finding and fixing bottlenecks']],b:[
{t:[['Symptom','Likely cause','First step'],['UNREACHABLE: Permission denied (publickey)','Wrong key or user','`ansible host -m ping -vvvv`, check `ansible_user`'],['Host key verification failed','Unknown host key','Add to known_hosts or set host key policy'],['No python interpreter found','Python missing or non-standard path','Install Python or set `ansible_python_interpreter`'],['Missing sudo password','become needs a password','Use `-K` or configure passwordless sudo'],['Module not found','Collection missing','`ansible-galaxy collection install`'],['Variable is undefined','Wrong scope or precedence','`debug: var=` and check group_vars'],['Task always changed','Command or shell without changed_when','Add `creates` or `changed_when`'],['Run is slow','Fact gathering, low forks, no pipelining','Disable facts, raise forks, enable pipelining'],['Templates render wrong','Whitespace or undefined values','`--check --diff`, use `default`'],['Vault decryption failed','Wrong password or ID','Check `--vault-id`']]}
]},
{t:'Common modules',d:'A short list of modules that cover most work.',see:[[3,1,'Files and content: file, copy, fetch, lineinfile and blockinfile'],[3,2,'Packages and services: package, apt, dnf and systemd_service']],b:[
{t:[['Need','Module'],['Install a package','`ansible.builtin.package`, `apt`, `dnf`'],['Manage a service','`ansible.builtin.systemd_service`'],['Copy a file','`ansible.builtin.copy`'],['Render a template','`ansible.builtin.template`'],['Edit one line','`ansible.builtin.lineinfile`'],['Manage a user','`ansible.builtin.user`, `authorized_key`'],['Download','`ansible.builtin.get_url`, `uri`'],['Run a command','`ansible.builtin.command`, `shell`, `script`'],['Wait for a port','`ansible.builtin.wait_for`'],['Set a fact','`ansible.builtin.set_fact`, `debug`'],['Clone a repository','`ansible.builtin.git`']]}
]},
]};
