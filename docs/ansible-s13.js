/* LearnSphere - Ansible, Section 13: Scale: AWX, Automation Platform & Event-Driven Ansible.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,AWX=K.AWX,AU=K.AWXU;

/* ---------- diagrams ---------- */
const awxArch=K.dg(700,290,[
[10,10,680,270,'AWX / automation controller architecture',1],
[30,50,150,50,'Users, CI, API clients',0],
[230,45,200,60,'Web UI and REST API',2],
[230,125,200,60,'Task engine|dispatcher, scheduler',2],
[30,125,150,60,'PostgreSQL|state and history',0],
[500,45,170,50,'Redis, receptor|messaging',0],
[500,125,170,60,'Execution nodes|run jobs in EEs',2],
[230,210,200,50,'Managed hosts, cloud APIs',0]],
[[180,75,230,75],[330,105,330,125],[230,155,180,155],[430,155,500,155],[585,185,330,235],[430,75,500,70]]);

const objects=K.dg(700,230,[
[10,10,680,210,'How the core objects connect',1],
[30,60,130,50,'Project|Git repository',0],[30,130,130,50,'Inventory|hosts, sources',0],[200,95,130,60,'Credentials|SSH, vault, cloud',0],
[390,85,130,80,'Job template|playbook + inputs',2],[570,60,100,50,'Job|a run',2],[570,130,100,50,'Workflow',0]],
[[160,85,390,110],[160,155,390,135],[330,125,390,125],[520,115,570,85],[520,140,570,150]]);

const meshD=K.dg(700,200,[
[10,10,680,180,'Automation mesh',1],
[30,70,130,60,'Control plane|controller',2],[220,70,120,60,'Hop node|DMZ gateway',0],[400,35,130,50,'Execution node|site A',2],[400,115,130,50,'Execution node|site B',2],[580,60,90,70,'Targets|in remote|networks',0]],
[[160,100,220,100],[340,90,400,60],[340,110,400,140],[530,60,580,90],[530,140,580,110]]);

const edaFlow=K.dg(700,170,[
[10,10,680,150,'Event-Driven Ansible',1],
[25,60,130,60,'Event source|Alertmanager,|webhook, Kafka',0],[195,60,130,60,'Rulebook|conditions',2],[365,60,130,60,'Action|run job template|or playbook',2],[535,60,135,60,'Result|issue fixed|or ticket created',0]],
[[155,90,195,90],[325,90,365,90],[495,90,535,90]]);

/* ---------- 0: Architecture ---------- */
L['ansible:12:0']={blocks:[
{p:'The command line is perfect for individuals. Teams need shared credentials that people cannot see, access control, scheduling, a history of every run and an API. That is what **AWX** and **Red Hat Ansible Automation Platform** provide, without replacing Ansible itself.'},
{svg:awxArch},
{h:'Components'},
{t:[['Component','Role'],
['**Web UI and REST API**','Everything in the UI is an API call; CI tools use the same API'],
['**Task engine**','Schedules and dispatches jobs, tracks capacity'],
['**Database (PostgreSQL)**','Inventories, credentials (encrypted), job history'],
['**Execution nodes**','Run playbooks inside execution environment containers'],
['**Receptor / mesh**','Connects control and execution nodes across networks'],
['**Execution environments**','Container images with ansible-core and collections']]},
{h:'AWX and the product'},
{t:[['','AWX','Automation Platform'],
['Nature','Upstream open-source project','Supported commercial product'],
['Releases','Frequent, continuous','Versioned, with long support lifecycles'],
['Includes','Controller functions','Controller, Automation Hub, Event-Driven Ansible, platform gateway, Insights'],
['Support','Community','Vendor support and certified content'],
['Installed with','AWX Operator on Kubernetes','Operator on OpenShift or RPM-based installer']]},
{h:'What a platform adds'},
{ul:['**Central credentials** that users can use but not read.','**RBAC** per organisation, team and object.','**Scheduling** and **workflows** with approvals.','**Audit** of who ran what, when, with which inputs.','**Scale**: parallel jobs across execution nodes.','A **stable API** for pipelines and ticketing systems.']},
{h:'When you need it'},
{flow:['One or two people with a repository: CLI and CI are enough','Several teams, shared secrets: a platform is worth considering','Auditors need run history and approvals: platform','Hundreds of hosts, many schedules: platform with mesh']},
{note:'The playbooks are the same. A job in AWX is `ansible-playbook` running inside a container with your project and credentials injected for the duration.'}],
src:[['AWX documentation',AWX],['Ansible Automation Platform','https://docs.redhat.com/en/documentation/red_hat_ansible_automation_platform']]};

/* ---------- 1: Core objects ---------- */
L['ansible:12:1']={blocks:[
{p:'Five objects cover almost every use: **Organization**, **Project**, **Inventory**, **Credential** and **Job Template**. Understanding how they fit together is understanding the whole product.'},
{svg:objects},
{h:'The objects'},
{t:[['Object','What it holds','Notes'],
['**Organization**','Top-level container for teams and resources','Boundary for access control'],
['**Project**','Link to a Git repository and branch or tag','Synced before jobs; holds playbooks and roles'],
['**Inventory**','Hosts and groups, with variables','Can be static or synced from a cloud, SCM or script source'],
['**Credential**','A secret: SSH key, vault password, cloud token, SCM key','Encrypted; users can use, not read'],
['**Job template**','Playbook plus inventory, credentials, options','The thing you launch'],
['**Job**','One execution with its full output and settings','Immutable history']]},
{h:'First job, step by step'},
{flow:['Create or select an Organization','Add a Project pointing at the Git repository','Add an Inventory and hosts (or an inventory source)','Add a Machine credential (SSH key) and, if needed, a Vault credential','Create a Job Template choosing the playbook, inventory and credentials','Launch it and read the live output']},
{h:'Useful job template options'},
{t:[['Option','Purpose'],
['**Limit**','Restrict to a host pattern'],
['**Job tags / skip tags**','Run part of a playbook'],
['**Verbosity**','Same as `-v`'],
['**Prompt on launch**','Let the launcher choose limit, variables, tags'],
['**Enable privilege escalation**','become'],
['**Concurrent jobs**','Allow or prevent parallel runs'],
['**Execution environment**','Which container image to use']]},
{h:'Launch from the API'},
{code:`curl -s -X POST \\
  -H "Authorization: Bearer $AWX_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"extra_vars": {"release": "1.4.0"}, "limit": "web"}' \\
  https://awx.example.com/api/v2/job_templates/42/launch/`},
{note:'Prompt-on-launch for variables is powerful and risky. Use **surveys** (next lecture) to constrain what users can enter.'}],
src:[['Projects',AU+'projects.html'],['Job templates',AU+'job_templates.html'],['Credentials',AU+'credentials.html']]};

/* ---------- 2: Workflows, surveys, schedules ---------- */
L['ansible:12:2']={blocks:[
{p:'Single jobs are building blocks. **Workflows** chain them with logic, **surveys** collect validated input, and **schedules** run them on a timetable.'},
{h:'Workflows'},
{p:'A workflow is a graph of nodes. Each node is a job template, project sync, inventory sync, approval or another workflow. Edges say what happens next.'},
{t:[['Edge','Follows when'],
['**On success**','The previous node finished successfully'],
['**On failure**','The previous node failed'],
['**Always**','Regardless of the result']]},
{flow:['Sync project','Take a snapshot (job template)','Deploy to staging','Run verification tests','Approval node: a person confirms','Deploy to production in batches','On failure: roll back and notify']},
{ul:['**Approval nodes** pause until an authorised user approves or denies, with a timeout.','**Convergence** nodes wait for several parents before continuing.','Variables can be passed between nodes with `set_stats`.']},
{code:`- name: Pass a value to the next workflow node
  ansible.builtin.set_stats:
    data:
      deployed_release: "{{ release }}"`},
{h:'Surveys'},
{p:'A survey is a form shown at launch. It becomes extra variables for the job.'},
{t:[['Field type','Use'],
['Text, textarea','Names, comments'],
['Integer, float','Counts, sizes with min and max'],
['Multiple choice','One or more values from a fixed list'],
['Password','Value is hidden and not logged']]},
{p:'Using a survey with choices (for example `environment: dev, staging`) is safer than letting users type any extra variable.'},
{h:'Schedules'},
{ul:['Based on **RRULE** definitions: daily, weekly, monthly with a time zone.','Can be attached to job templates, workflows, project syncs and inventory syncs.','Typical uses: nightly compliance check, weekly patching window, hourly inventory sync.']},
{h:'Notifications'},
{p:'Attach notification templates (email, Slack, webhook and more) to job templates or workflows for start, success and failure events.'},
{note:'Design workflows so that a failed deployment leaves systems in a safe state: add explicit failure paths for rollback and for alerting a person.'}],
src:[['Workflows',AU+'workflows.html'],['Workflows and surveys',AU+'workflows.html'],['AWX user guide',AU+'index.html']]};

/* ---------- 3: RBAC and audit ---------- */
L['ansible:12:3']={blocks:[
{p:'With many people using one platform, access has to be deliberate. **RBAC** (role-based access control) decides who can see, run and change each object, and **auditing** shows what happened.'},
{h:'Concepts'},
{t:[['Concept','Meaning'],
['**User**','A person or service account, local or from LDAP, SAML, OIDC'],
['**Team**','A group of users within an organisation'],
['**Organization**','A boundary for resources and administration'],
['**Role**','A permission on one object, granted to a user or team']]},
{h:'Typical roles on a job template'},
{t:[['Role','Allows'],
['**Admin**','Change and delete the template'],
['**Execute**','Launch the template'],
['**Read**','View it and its jobs'],
['**Use** (on inventory, credential)','Attach to templates, without seeing the secret'],
['**Update** (on project)','Sync from SCM']]},
{h:'A sensible model'},
{flow:['Map people to Teams via the identity provider','Grant Teams roles on objects, not individuals','Developers: Admin on dev templates, Execute on staging','Operators: Execute on production templates','Auditors: Read everywhere']},
{h:'Credentials stay hidden'},
{p:'Users with the **Use** role can run jobs that use a credential, but cannot display or export the secret. This is the main security gain compared to sharing SSH keys and vault passwords.'},
{h:'Auditing'},
{ul:['**Activity stream** records changes to objects: who, what, when.','**Job history** stores output, inputs, the project revision and the user who launched.','**Log aggregation** can send events to Splunk, Elastic or syslog.','Keep **job output retention** policy aligned with audit needs.']},
{note:'Avoid giving broad "admin" to everyone. Review team membership regularly and prefer separate teams for production execute rights.'}],
src:[['Role-based access controls',AU+'security.html'],['Activity stream',AU+'activity_streams.html']]};

/* ---------- 4: EE and mesh ---------- */
L['ansible:12:4']={blocks:[
{p:'Dependencies are the usual source of "works on my machine". An **execution environment (EE)** is a container image containing ansible-core, collections, Python libraries and system packages. The same image runs in development, CI and on the platform.'},
{h:'Build an EE'},
{code:`# execution-environment.yml
version: 3
images:
  base_image:
    name: quay.io/ansible/ansible-runner:latest
dependencies:
  galaxy: requirements.yml        # collections
  python: requirements.txt        # Python libraries
  system: bindep.txt              # OS packages`},
{code:`pip install ansible-builder
ansible-builder build --tag registry.example.com/ee/web:1.0 --file execution-environment.yml
podman push registry.example.com/ee/web:1.0`},
{h:'Run content with an EE'},
{code:`pip install ansible-navigator
ansible-navigator run site.yml -i inventory \\
  --execution-environment-image registry.example.com/ee/web:1.0 --mode stdout`},
{t:[['Tool','Purpose'],
['`ansible-builder`','Builds EE images from a definition'],
['`ansible-navigator`','Runs and explores content inside EEs'],
['`ansible-runner`','The execution engine that jobs use']]},
{h:'Automation mesh'},
{svg:meshD},
{t:[['Node type','Role'],
['**Control**','Schedules jobs and manages the platform'],
['**Execution**','Runs jobs in EEs'],
['**Hybrid**','Both control and execution'],
['**Hop**','Relays traffic between networks, runs no jobs']]},
{p:'Mesh uses **Receptor** to connect nodes over TCP, so execution can sit close to managed hosts in other data centres, DMZs or clouds while the control plane stays central.'},
{h:'Instance groups and container groups'},
{ul:['**Instance groups** pin a template or inventory to certain execution nodes.','**Container groups** run each job in a pod on Kubernetes and release the capacity afterwards.']},
{note:'Version EE tags like application releases and test them. Updating one collection inside an EE is a change that deserves a pipeline run.'}],
src:[['ansible-builder',K.BLD],['ansible-navigator',K.NAV],['AWX documentation',AWX]]};

/* ---------- 5: EDA ---------- */
L['ansible:12:5']={blocks:[
{p:'Most automation starts when a person or a schedule runs it. **Event-Driven Ansible (EDA)** lets automation react to events: an alert fires, a webhook arrives or a service check fails, and a response runs automatically.'},
{svg:edaFlow},
{h:'Vocabulary'},
{t:[['Term','Meaning'],
['**Source**','Plugin that produces events (webhook, Alertmanager, Kafka, file, url_check)'],
['**Rule**','A condition on event data plus the actions to take'],
['**Rulebook**','YAML file that groups sources and rules'],
['**Action**','What to do: run a playbook, run a job template, set a fact, post an event'],
['**Decision environment**','Container image used to run `ansible-rulebook`']]},
{h:'A rulebook'},
{code:`# restart-on-alert.yml
- name: Auto-remediate web failures
  hosts: all
  sources:
    - ansible.eda.alertmanager:
        host: 0.0.0.0
        port: 5050
  rules:
    - name: Restart nginx when it is down
      condition: event.alert.labels.alertname == "NginxDown"
      action:
        run_job_template:
          name: Restart nginx
          organization: Operations
          job_args:
            extra_vars:
              target_host: "{{ event.alert.labels.instance }}"`},
{code:`# run locally for testing
ansible-rulebook --rulebook restart-on-alert.yml -i inventory --verbose`},
{h:'Typical use cases'},
{ul:['Remediate known issues: restart a service, clear a disk, scale a group.','Enrich tickets: create an incident with diagnostics collected by a playbook.','Security response: isolate a host on a detection event.','Compliance: re-apply configuration when drift is detected.']},
{h:'Safety rules'},
{flow:['Start by only notifying or creating tickets','Add automatic action for well-understood, low-risk faults','Rate-limit and deduplicate events','Keep a human approval step for high-impact actions','Log every event and action for review']},
{note:'Event-driven automation can amplify mistakes at machine speed. Make remediation playbooks idempotent, bounded and tested like any production code.'}],
src:[['Event-Driven Ansible rulebooks',K.EDA]]};

/* ---------- 6: Performance ---------- */
L['ansible:12:6']={blocks:[
{p:'Ansible is fast enough for most fleets, and slow on a few specific things: SSH round trips, fact gathering and loops. Measure first, then tune the settings that matter.'},
{h:'Where time goes'},
{t:[['Cause','Why it is slow','Remedy'],
['Few forks','Only 5 hosts at once by default','Raise `forks`'],
['SSH setup per task','New connection and temp directory each time','`ControlPersist`, `pipelining`'],
['Fact gathering','Setup module on every host every play','`gather_facts: false`, smart gathering, caching'],
['Many small tasks','Each task is a round trip','Use list arguments, fewer tasks'],
['Slow hosts hold the batch','`linear` waits for all hosts','`free` strategy, `serial` batches'],
['Long operations','Waiting inside a task','`async` and `poll`']]},
{h:'ansible.cfg tuning'},
{code:`[defaults]
forks = 50
gathering = smart
fact_caching = jsonfile
fact_caching_connection = ~/.ansible/fact_cache
fact_caching_timeout = 7200
callbacks_enabled = ansible.posix.profile_tasks

[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
retries = 2`},
{t:[['Setting','Effect'],
['`forks`','Parallel hosts; limited by control node CPU and memory'],
['`pipelining = True`','Fewer SSH operations per task; needs sudoers without `requiretty`'],
['`ControlPersist`','Reuse one SSH connection for many tasks (usually default)'],
['`gathering = smart` + cache','Skip fact gathering when cached']]},
{h:'Long-running tasks'},
{code:`- name: Run a long job without holding the SSH session
  ansible.builtin.command: /opt/app/bin/reindex
  async: 3600       # allow up to an hour
  poll: 0           # fire and forget
  register: job

- name: Check on it
  ansible.builtin.async_status:
    jid: "{{ job.ansible_job_id }}"
  register: result
  until: result.finished
  retries: 60
  delay: 30`},
{h:'Method'},
{flow:['Enable profile_tasks and find the slowest tasks','Turn off or cache facts where unused','Enable pipelining and persistent SSH','Increase forks within control node limits','Restructure tasks, then re-measure']},
{h:'On AWX'},
{ul:['Job **forks** and the instance **capacity** determine how many jobs run in parallel.','Add execution nodes or container groups to scale out.','Use **job slicing** to split one job over many hosts into parallel jobs.']},
{note:'Do not raise forks blindly. Each fork uses memory and can overload the target service you are updating. For rolling updates, `serial` is a stronger control than forks.'}],
src:[['Ansible configuration settings',D+'reference_appendices/config.html'],['Asynchronous actions',UG+'playbooks_async.html']]};
})();
