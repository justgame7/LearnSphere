/* LearnSphere - Ansible, Section 01: Introduction & Automation Foundations.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG;

/* ---------- diagrams ---------- */
const roadmap=K.dg(700,200,[
[10,10,680,180,'The learning path',1],
[25,60,100,60,'Foundations|and install',0],[145,60,100,60,'Inventory and|ad-hoc',0],[265,60,100,60,'Playbooks,|variables',0],[385,60,100,60,'Roles and|collections',0],[505,60,80,60,'Secrets,|testing',0],[600,60,80,60,'Scale and|operate',2]],
[[125,90,145,90],[245,90,265,90],[365,90,385,90],[485,90,505,90],[585,90,600,90]]);

const drift=K.dg(700,200,[
[10,10,680,180,'Manual administration over time',1],
[30,60,120,60,'Day 1|3 identical servers',0],[200,60,140,60,'Hotfix on web2|by hand',0],[390,60,140,60,'Package updated|on web1 only',0],[580,60,100,60,'3 servers,|3 states',2]],
[[150,90,200,90],[340,90,390,90],[530,90,580,90]]);

const pushModel=K.dg(700,220,[
[10,10,680,200,'Agentless push model',1],
[30,80,140,70,'Control node|ansible installed',2],
[270,40,150,50,'web1  (SSH)',0],[270,100,150,50,'db1  (SSH)',0],[270,160,150,40,'win1  (WinRM)',0],
[520,50,150,100,'Nothing to install:|SSH or WinRM and|Python are enough',0]],
[[170,105,270,65],[170,115,270,125],[170,125,270,180],[420,125,520,100]]);

/* ---------- 0: Course overview ---------- */
L['ansible:0:0']={blocks:[
{p:'This course takes you from **never having used Ansible** to automating real platforms in production. It is built around one idea: describe the state you want in simple YAML files, and let Ansible make the servers match it, safely and repeatably.'},
{svg:roadmap},
{h:'Who this course is for'},
{ul:['System administrators and DevOps engineers who configure servers by hand today.','Developers who need repeatable environments for their applications.','Engineers preparing for the **Red Hat Certified Engineer (RHCE) EX294** exam. The course is informed by its objectives, but is not limited to them.']},
{h:'What you will be able to do'},
{ul:['Write inventories, ad-hoc commands and playbooks that are idempotent and readable.','Organise automation as roles and collections, with variables and templates.','Protect secrets with Vault, harden hosts and keep an audit trail.','Test automation with lint, check mode and Molecule, and ship it through CI.','Scale with AWX or Automation Platform and react to events with Event-Driven Ansible.']},
{h:'The sections at a glance'},
{t:[['Sections','Theme','Outcome'],
['1 to 2','Foundations, install, lab','A working control node and managed hosts'],
['3 to 4','Inventory, ad-hoc, core modules','Target the right hosts and make changes from the command line'],
['5 to 7','Playbooks, variables, templates, control flow','Real playbooks with logic, loops, handlers and rolling updates'],
['8 to 9','Roles, collections, plugins','Reusable and shareable automation'],
['10 to 12','Security, patterns, testing and CI','Production-quality content'],
['13 to 14','AWX, EDA, troubleshooting, capstone','Operate at scale and prepare for the exam']]},
{h:'How lectures are tagged'},
{p:'Every lecture ends with a tag in its description so you know what it depends on.'},
{t:[['Tag','Meaning','Needs'],
['**Core**','Works with plain `ansible-core` on the command line','Only the control node'],
['**Platform**','Needs AWX or Red Hat Ansible Automation Platform','A running AWX or AAP instance'],
['**Both**','Concept applies everywhere','Nothing special']]},
{h:'Prerequisites self-check'},
{p:'You do not need to know Ansible. You should be comfortable with the items below. If one is weak, the optional refresher lecture in this section covers it.'},
{t:[['Skill','Quick test'],
['Linux shell','You can navigate folders, edit a file with `nano` or `vim` and read file permissions'],
['SSH','You can log in to a server with a key and know what `~/.ssh` holds'],
['Basic networking','You know what an IP address, a port and DNS are'],
['Package and service basics','You have run `apt` or `dnf` and `systemctl` before']]},
{note:'Practice matters more than reading. From Section 2 onward, keep a small lab running (three disposable machines or containers) and run every example.'}],
src:[['Ansible documentation',D],['Getting started',UG+'intro_getting_started.html']]};

/* ---------- 1: Why automate ---------- */
L['ansible:0:1']={blocks:[
{p:'Before learning a tool, it helps to see the problem it solves. Managing servers by logging in and typing commands works for one machine and fails quietly as the number grows.'},
{svg:drift},
{h:'Three problems of manual administration'},
{t:[['Problem','What it means','Typical consequence'],
['**Configuration drift**','Servers that started equal slowly differ as people make one-off changes','A fix works on web1 but breaks on web2'],
['**Snowflake servers**','A host that is unique and nobody can rebuild exactly','Fear of touching it; long recovery after failure'],
['**Toil**','Repetitive manual work with no lasting value','Slow delivery, tired engineers, copy and paste mistakes']]},
{h:'Why these hurt in practice'},
{ul:['**Reliability:** an outage caused by a change nobody recorded is hard to diagnose.','**Speed:** building ten servers by hand takes ten times as long, and each one is slightly different.','**Audit and security:** you cannot prove how a server was configured or who changed what.','**Knowledge:** the real procedure lives in someone head, not in a repository.']},
{h:'What automation changes'},
{t:[['Without automation','With automation'],
['Procedure in a wiki, partly out of date','Procedure is code that is executed'],
['Each run is a fresh chance for a typo','Same input gives the same result'],
['Server state is whatever it happens to be','Desired state is written down and enforced'],
['Changes are invisible','Changes are reviewed in version control']]},
{h:'Infrastructure as code'},
{p:'Ansible follows the **infrastructure as code** approach: configuration is stored in text files, versioned in Git, reviewed like application code and applied by a tool. A new server is built by running the code, not by remembering steps.'},
{flow:['Write or change automation code','Review it (pull request)','Test it on a lab or staging','Apply it with Ansible','Servers match the code; Git is the record']},
{note:'Automation does not remove the need for judgment. It makes your decisions repeatable. A wrong playbook is applied perfectly everywhere, which is why testing and check mode (later sections) matter.'}],
src:[['Ansible overview',UG+'intro.html']]};

/* ---------- 2: What Ansible is ---------- */
L['ansible:0:2']={blocks:[
{p:'**Ansible** is an open-source automation tool for configuration management, application deployment, orchestration and provisioning. Three properties explain most of its design: it is **agentless**, **push-based** and **declarative**.'},
{svg:pushModel},
{h:'Agentless'},
{p:'Managed hosts do not run an Ansible agent. For Linux and network devices, Ansible connects over **SSH**; for Windows it uses **WinRM** (or SSH). The only requirement on a Linux host is a Python interpreter, which almost every distribution already has.'},
{h:'What happens when a task runs'},
{flow:['Ansible reads the task and the target host list','It connects over SSH','It copies a small Python program (the module) to a temporary folder','It runs the module and collects a JSON result','It removes the temporary files and reports changed, ok or failed']},
{h:'Push-based'},
{p:'The control node **pushes** work when you run a command. There is no always-running client polling a server. Contrast this with pull tools, where agents ask a master for their configuration on a schedule.'},
{h:'Declarative'},
{p:'You describe the **end state** ("package nginx is present, service is running") instead of the steps to get there. Each module checks the current state and acts only when it differs. That is what makes a playbook safe to run again (lecture 6 of this section).'},
{code:`- name: Make sure nginx is installed and running
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present

    - name: Start and enable the service
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true`},
{h:'Why people adopt it'},
{ul:['**Low barrier:** YAML, no custom language and no agents to roll out.','**Readable:** a playbook doubles as documentation.','**Wide reach:** servers, cloud, containers, network and Windows from one tool.','**Large ecosystem:** thousands of modules in collections.']},
{h:'Honest trade-offs'},
{ul:['SSH-per-task has overhead, so very large fleets need tuning (Section 13).','It is not a continuous enforcement agent; drift is corrected when you run it again.','Complex logic in YAML can become hard to read, which is why roles and tests matter.']}],
src:[['How Ansible works',UG+'intro.html'],['Connection methods',UG+'connection_details.html']]};

/* ---------- 3: Architecture ---------- */
L['ansible:0:3']={blocks:[
{p:'Ansible has few moving parts. If you can name them and follow a command through them, most behaviour becomes predictable.'},
{svg:K.dg(700,260,[
[10,10,680,240,'Ansible architecture',1],
[25,45,310,190,'Control node',1],
[40,75,130,40,'Playbook / ad-hoc',0],[40,125,130,40,'Inventory',2],[40,175,130,40,'ansible.cfg',0],
[190,75,130,40,'Modules',2],[190,125,130,40,'Plugins',0],[190,175,130,40,'Collections',0],
[440,60,110,50,'web1',0],[440,125,110,50,'db1',0],[440,190,110,40,'win1',0],[580,100,100,70,'Managed|nodes run|the module',0]],
[[335,85,440,85],[335,150,440,150],[335,210,440,210],[550,150,580,140]])},
{h:'The parts'},
{t:[['Part','What it is','Where it lives'],
['**Control node**','Machine where Ansible is installed and run. Linux or macOS (or WSL); not native Windows','Your laptop, a bastion or an AWX runner'],
['**Managed node**','A target host or device. Also called a host','Servers, VMs, network gear'],
['**Inventory**','List of managed nodes, grouped, with variables','File, directory or dynamic plugin'],
['**Module**','Small program that does one job, such as install a package','Collections on the control node'],
['**Task**','One call of a module with arguments','Inside a play'],
['**Play and playbook**','A play maps hosts to tasks; a playbook is a YAML file of plays','Your project'],
['**Plugin**','Extends Ansible core itself: connection, lookup, filter, callback, inventory','Collections or local folders'],
['**Collection**','Distribution format that bundles modules, plugins and roles','Installed from Galaxy or Git']]},
{h:'Modules versus plugins'},
{p:'The two are easy to confuse. **Modules run on the managed node** (or on the target API) and perform the work. **Plugins run on the control node** and change how Ansible itself behaves, for example how it connects, how it formats output or how it looks up data.'},
{h:'Following one command'},
{code:`ansible web -m ansible.builtin.ping`},
{flow:['Read ansible.cfg and the inventory','Resolve the pattern web to a list of hosts','Open an SSH connection to each host in parallel (forks)','Run the ping module and return JSON','Print one result per host']},
{note:'Forks: Ansible works on several hosts at once. The default is 5 parallel hosts. Raising it speeds up large runs and is covered in the scale section.'}],
src:[['Concepts',UG+'basic_concepts.html'],['Glossary',D+'reference_appendices/glossary.html']]};

/* ---------- 4: The family ---------- */
L['ansible:0:4']={blocks:[
{p:'The word "Ansible" refers to several related things. Knowing them avoids confusion when reading documentation or choosing what to install.'},
{svg:K.dg(700,230,[
[10,10,680,210,'The Ansible family',1],
[30,50,200,60,'ansible-core|engine, CLI, builtin modules',2],
[250,50,200,60,'Collections|content on Galaxy and Git',0],
[470,50,200,60,'ansible (community)|core + curated collections',0],
[30,140,200,60,'ansible-navigator|ansible-builder, runner',0],
[250,140,200,60,'AWX|upstream web UI and API',0],
[470,140,200,60,'Automation Platform|supported Red Hat product',2]],
[[230,80,250,80],[450,80,470,80],[250,170,230,170],[450,170,470,170]])},
{h:'What each one is'},
{t:[['Name','What it is','Install it when'],
['**ansible-core**','The engine: CLI tools, language, `ansible.builtin` modules and plugins','You want a small, controlled install and pick your own collections'],
['**ansible** (community package)','ansible-core plus a curated set of collections, released on a fixed schedule','You want a batteries-included install for learning'],
['**Collections**','Versioned bundles of modules, plugins and roles','Always: you add what you need and pin versions'],
['**AWX**','Open-source web UI, REST API and task engine (upstream project)','You want a UI, RBAC and scheduling and accept upstream releases'],
['**Red Hat Ansible Automation Platform**','Supported product built from AWX and related projects, with Event-Driven Ansible and execution environments','You need vendor support and certified content'],
['**Execution environment**','Container image with ansible-core, collections and Python dependencies','Consistent runs on every machine']]},
{h:'How they depend on each other'},
{ul:['Everything is built on **ansible-core**.','Collections are installed **on top of** ansible-core. Since version 2.10, most modules left core and moved into collections.','AWX and Automation Platform **run** ansible-core inside an execution environment; they do not replace it.']},
{h:'Which one this course uses'},
{p:'Sections 1 to 12 and 14 only need the **command line** (`ansible-core`, plus collections you install explicitly). Section 13 introduces AWX and Event-Driven Ansible. Lecture tags (Core, Platform, Both) tell you which one a lesson relies on.'},
{code:`# the engine only
pip install ansible-core

# the community package (core + many collections)
pip install ansible

ansible --version`},
{note:'Always check which version your documentation page is for. Module names and behaviour change between releases; the docs have a version selector.'}],
src:[['Installation guide',K.INST+'intro_installation.html'],['Ansible community changelogs',D+'porting_guides/porting_guides.html']]};

/* ---------- 5: Idempotency ---------- */
L['ansible:0:5']={blocks:[
{p:'**Idempotency** means that applying the same operation once or many times gives the same result. It is the most important idea in Ansible. A playbook should describe a state, so running it twice should change nothing the second time.'},
{h:'A shell script versus a module'},
{code:`# Shell script: each run appends again
echo "PermitRootLogin no" >> /etc/ssh/sshd_config

# Ansible: ensures exactly one matching line
- name: Disable root SSH login
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: "^#?PermitRootLogin"
    line: "PermitRootLogin no"`},
{p:'Run the script three times and the file has three copies of the line. Run the module three times and the file has one line; the second and third runs report **ok** instead of **changed**.'},
{h:'See it yourself'},
{code:`- name: Idempotency demo
  hosts: localhost
  tasks:
    - name: Create a directory
      ansible.builtin.file:
        path: /tmp/demo
        state: directory
        mode: "0755"`},
{code:`# First run
TASK [Create a directory] *****
changed: [localhost]
PLAY RECAP *****
localhost : ok=1  changed=1  unreachable=0  failed=0

# Second run
TASK [Create a directory] *****
ok: [localhost]
PLAY RECAP *****
localhost : ok=1  changed=0  unreachable=0  failed=0`},
{h:'How a module decides'},
{flow:['Read the desired state from the task','Inspect the current state of the host','If they match, report ok and do nothing','If they differ, make the change','Report changed (or failed)']},
{h:'Result states you will see'},
{t:[['State','Meaning'],
['**ok**','Already in the desired state; nothing was changed'],
['**changed**','The module changed something'],
['**failed**','The task could not complete'],
['**skipped**','A condition made the task not apply'],
['**unreachable**','Ansible could not connect to the host']]},
{h:'Where idempotency breaks'},
{p:'The `command` and `shell` modules know nothing about state, so they always report **changed**. Section 4 shows how `creates`, `removes` and `changed_when` repair this. Prefer a dedicated module whenever one exists.'},
{note:'A good test of any playbook: run it twice. The second run should show `changed=0`. Section 12 turns that into an automated test.'}],
src:[['Desired state and idempotency',D+'reference_appendices/glossary.html#term-Idempotency']]};

/* ---------- 6: Tool comparison ---------- */
L['ansible:0:6']={blocks:[
{p:'Several tools overlap with Ansible, and teams often ask which one to choose. The honest answer is that they solve different layers of the problem, and many teams use more than one.'},
{h:'The layers'},
{t:[['Layer','Question it answers','Typical tools'],
['**Provisioning**','What infrastructure exists (networks, VMs, databases)?','Terraform, OpenTofu, CloudFormation, Pulumi'],
['**Configuration management**','What is installed and configured on each machine?','Ansible, Chef, Puppet, Salt'],
['**Orchestration**','In what order and across which hosts do changes happen?','Ansible, Rundeck, workflow engines'],
['**Image building**','What does the base image contain?','Packer, Docker builds']]},
{h:'Comparing the configuration tools'},
{t:[['','Ansible','Puppet','Chef','Salt'],
['Agent','Agentless (SSH, WinRM)','Agent on every node','Agent (chef-client)','Agent (minion) or agentless salt-ssh'],
['Model','Push, run on demand','Pull, on a schedule','Pull, on a schedule','Push or pull, event bus'],
['Language','YAML + Jinja2','Puppet DSL','Ruby DSL','YAML + Jinja2'],
['Setup effort','Low','Medium to high','Medium to high','Medium'],
['Strength','Simplicity, orchestration','Continuous enforcement at scale','Flexibility in Ruby','Speed, remote execution']]},
{h:'Ansible and Terraform'},
{p:'**Terraform** keeps a state file and is excellent at creating and destroying cloud resources. **Ansible** is excellent at configuring what runs inside them and at multi-step operations. They are complementary.'},
{svg:K.dg(700,170,[
[10,10,680,150,'A common combination',1],
[30,60,140,60,'Terraform|creates VMs, network',2],[230,60,140,60,'Inventory|IPs from outputs',0],[430,60,140,60,'Ansible|configures, deploys',2],[610,60,70,60,'Running|service',0]],
[[170,90,230,90],[370,90,430,90],[570,90,610,90]])},
{h:'Choosing, in practice'},
{ul:['Need cloud resources created and tracked with state? **Terraform** (or similar).','Need to configure operating systems, deploy releases and run runbooks? **Ansible**.','Need continuous enforcement on thousands of long-lived nodes with strict reporting? Consider **Puppet** or **Salt**, or run Ansible from AWX on a schedule.','Already invested in a tool and it works? Switching rarely pays for itself.']},
{note:'Ansible can create cloud resources too, through collections such as amazon.aws. It does not track state the way Terraform does, so large dynamic infrastructure is usually better managed in Terraform and then handed to Ansible.'}],
src:[['Ansible overview',UG+'intro.html'],['Terraform vs Ansible (HashiCorp docs)','https://developer.hashicorp.com/terraform/intro']]};
})();
