/* LearnSphere - Ansible, Section 05: Playbooks & YAML.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,PB=K.PB;

/* ---------- diagrams ---------- */
const anatomy=K.dg(700,290,[
[10,10,680,270,'Playbook (site.yml)',1],
[30,45,300,100,'Play 1: webservers',1],
[45,75,130,50,'Task: install nginx',0],[190,75,130,50,'Task: deploy config',2],
[30,160,300,100,'Play 2: databases',1],
[45,190,130,50,'Task: install pg',0],[190,190,130,50,'Task: create db',0],
[380,75,130,50,'hosts: web',0],[380,190,130,50,'hosts: db',0],
[550,60,120,80,'Handlers|run at the end|if notified',0]],
[[320,100,380,100],[320,215,380,215],[510,100,550,100]]);

const handlerFlow=K.dg(700,160,[
[10,10,680,140,'Handler lifecycle',1],
[30,55,140,60,'Task changes|the config file',2],[220,55,130,60,'notify:|restart nginx',0],[400,55,130,60,'More tasks|run on',0],[570,55,100,60,'Handler|runs once',2]],
[[170,85,220,85],[350,85,400,85],[530,85,570,85]]);

/* ---------- 0: YAML ---------- */
L['ansible:4:0']={blocks:[
{p:'Everything you write in Ansible is YAML. It is easy to read, and also easy to get subtly wrong. A short, careful review of the rules removes a whole class of confusing errors.'},
{h:'The basic building blocks'},
{code:`# a comment
name: web1                 # scalar: string
port: 8080                 # scalar: number
enabled: true              # scalar: boolean

packages:                  # list (sequence)
  - nginx
  - curl

database:                  # dictionary (mapping)
  host: db1
  port: 5432

users: [alice, bob]        # inline list
limits: {cpu: 2, mem: 4}   # inline dictionary`},
{h:'Rules that matter'},
{ul:['**Indent with spaces**, never tabs. Two spaces is the convention.','Items in the same list or mapping must align exactly.','A key and its value are separated by a colon **and a space**.','A `#` starts a comment.','A document can start with `---`.']},
{h:'Strings and quoting'},
{t:[['Situation','Write','Reason'],
['Value starts with `{{`','`"{{ var }}"`','Otherwise YAML thinks it is a dictionary'],
['Value contains `: ` or `#`','`"time: 5"`','Colon-space and hash are special'],
['File modes','`"0644"`','Avoid number conversion'],
['Versions like 3.10','`"3.10"`','Otherwise becomes the number 3.1'],
['Strings with leading `*`, `&`, `!`, `@`','Quote them','They have a special meaning']]},
{h:'Booleans and the Norway problem'},
{p:'YAML 1.1 treats `yes`, `no`, `on`, `off`, `y` and `n` as booleans. A country code list `[SE, NO, DK]` therefore turns **NO** into `false`. Use `true` and `false` for booleans and quote string values that could be misread.'},
{code:`countries: ["SE", "NO", "DK"]     # quoted: stays text
become: true                      # preferred boolean`},
{h:'Multi-line text'},
{code:`# literal block: keeps line breaks (scripts, configs)
motd: |
  Welcome to {{ inventory_hostname }}
  Authorised use only.

# folded block: joins lines with spaces (long sentences)
description: >
  This is one long
  sentence on one line.`},
{h:'Anchors and aliases (optional)'},
{code:`defaults: &defaults
  owner: root
  mode: "0644"

file1:
  <<: *defaults
  path: /etc/a
file2:
  <<: *defaults
  path: /etc/b`},
{h:'Tools that help'},
{ul:['**yamllint** reports indentation and style errors.','`ansible-playbook --syntax-check` finds structural problems.','Editor plugins for YAML highlight alignment mistakes as you type.']},
{note:'Most "mapping values are not allowed here" errors come from a missing space after a colon or an unquoted value containing a colon.'}],
src:[['YAML syntax',UG+'playbooks_intro.html#playbook-syntax'],['YAML specification','https://yaml.org/spec/']]};

/* ---------- 1: Anatomy ---------- */
L['ansible:4:1']={blocks:[
{p:'A **playbook** is a YAML file containing a list of **plays**. A play maps a group of hosts to a list of **tasks**. A task calls one **module**. That hierarchy is all there is.'},
{svg:anatomy},
{h:'A complete playbook'},
{code:`---
- name: Configure web servers
  hosts: web
  become: true
  gather_facts: true
  vars:
    http_port: 80

  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present

    - name: Start nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

- name: Configure database servers
  hosts: db
  become: true
  tasks:
    - name: Install PostgreSQL
      ansible.builtin.package:
        name: postgresql-server
        state: present`},
{h:'Play keywords'},
{t:[['Keyword','Purpose'],
['`name`','Description shown in the output'],
['`hosts`','Pattern selecting the targets (required)'],
['`become`, `become_user`','Privilege escalation for the whole play'],
['`gather_facts`','Whether to run setup first'],
['`vars`, `vars_files`','Variables for the play'],
['`pre_tasks`, `tasks`, `post_tasks`','Task lists, in that order'],
['`roles`','Roles to apply (Section 8)'],
['`handlers`','Tasks run only when notified'],
['`serial`','Batch size for rolling updates (Section 7)']]},
{h:'Task anatomy'},
{code:`- name: Create the data directory          # always name tasks
  ansible.builtin.file:                    # module (use the FQCN)
    path: /var/lib/app                     # module arguments
    state: directory
  when: ansible_facts['os_family'] == "RedHat"   # task keyword
  tags: [setup]`},
{h:'Order of execution'},
{flow:['Plays run top to bottom','Within a play: pre_tasks, then roles, then tasks, then post_tasks','Each task runs on all hosts (in batches of forks) before the next starts','Handlers run at the end of each section if notified']},
{h:'Fully qualified collection names'},
{p:'Write `ansible.builtin.copy`, not `copy`. The FQCN removes ambiguity when several collections provide a module with the same short name, and linters expect it.'},
{note:'Always give plays and tasks a `name`. Names are what you read in the output and in AWX job logs.'}],
src:[['Working with playbooks',UG+'playbooks.html'],['Playbook keywords',D+'reference_appendices/playbooks_keywords.html']]};

/* ---------- 2: Running ---------- */
L['ansible:4:2']={blocks:[
{p:'`ansible-playbook` runs a playbook. A few options let you check it, narrow it and see more detail before and during execution.'},
{h:'The usual sequence'},
{flow:['--syntax-check: is the YAML and structure valid?','--list-hosts and --list-tasks: what will it touch?','--check --diff: what would change?','Run with --limit on one host first','Run on the full set']},
{code:`ansible-playbook -i inventory site.yml --syntax-check
ansible-playbook -i inventory site.yml --list-hosts
ansible-playbook -i inventory site.yml --list-tasks
ansible-playbook -i inventory site.yml --check --diff --limit web01
ansible-playbook -i inventory site.yml --limit web01
ansible-playbook -i inventory site.yml`},
{h:'Useful options'},
{t:[['Option','Purpose'],
['`-i`','Inventory'],
['`-l`, `--limit`','Restrict hosts'],
['`-e`','Extra variables, highest precedence'],
['`-t`, `--tags` / `--skip-tags`','Run or skip tagged tasks'],
['`--start-at-task "name"`','Begin at a named task'],
['`--step`','Confirm every task'],
['`-v` ... `-vvvv`','Increasing detail'],
['`-b`, `-K`','Become and ask for the password'],
['`--forks`','Parallel hosts']]},
{h:'Reading the output'},
{code:`PLAY [Configure web servers] ****************************
TASK [Gathering Facts] ***********************************
ok: [web01]
TASK [Install nginx] *************************************
changed: [web01]
TASK [Start nginx] ***************************************
ok: [web01]

PLAY RECAP ***********************************************
web01 : ok=3  changed=1  unreachable=0  failed=0  skipped=0  rescued=0  ignored=0`},
{t:[['Recap field','Meaning'],
['**ok**','Task ran and found no change needed (also counts changed tasks)'],
['**changed**','The task changed something'],
['**unreachable**','Could not connect; host dropped from the rest of the run'],
['**failed**','Task returned an error; host dropped'],
['**skipped**','A condition prevented it from running'],
['**rescued**','A block failure was handled by rescue'],
['**ignored**','Failed but `ignore_errors` was set']]},
{h:'When a host fails'},
{p:'A failed host is removed from the rest of the play, other hosts continue. Fix and re-run with `--limit` on the failed hosts only.'},
{note:'The exit code is non-zero if any host failed or was unreachable, which is how CI pipelines detect problems.'}],
src:[['ansible-playbook',K.CLI+'ansible-playbook.html'],['Executing playbooks',UG+'playbooks_intro.html#running-playbooks']]};

/* ---------- 3: Handlers ---------- */
L['ansible:4:3']={blocks:[
{p:'Restarting a service on every run is wasteful and risky. A **handler** is a task that runs only when another task **notifies** it, and only if that task actually **changed** something.'},
{svg:handlerFlow},
{code:`- name: Web server configuration
  hosts: web
  become: true
  tasks:
    - name: Deploy nginx configuration
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
        validate: "nginx -t -c %s"
      notify: Restart nginx

    - name: Deploy site configuration
      ansible.builtin.template:
        src: site.conf.j2
        dest: /etc/nginx/conf.d/site.conf
      notify: Restart nginx

  handlers:
    - name: Restart nginx
      ansible.builtin.service:
        name: nginx
        state: restarted`},
{h:'Rules'},
{ul:['A handler runs **once**, at the end of the play section, even if notified by many tasks.','Handlers run in the order they are **defined**, not the order they were notified.','Handlers are only triggered if the notifying task reports **changed**.','If a task fails on a host, the pending handlers for that host do not run (unless `force_handlers: true`).']},
{h:'Run handlers now'},
{code:`- name: Update configuration
  ansible.builtin.template:
    src: app.conf.j2
    dest: /etc/app/app.conf
  notify: Restart app

- name: Run handlers immediately, before the smoke test
  ansible.builtin.meta: flush_handlers

- name: Smoke test
  ansible.builtin.uri:
    url: http://localhost:8080/health`},
{h:'Group handlers with listen'},
{code:`handlers:
  - name: Restart web stack
    ansible.builtin.service:
      name: nginx
      state: restarted
    listen: "web stack changed"

  - name: Reload app
    ansible.builtin.service:
      name: app
      state: reloaded
    listen: "web stack changed"

# a task: notify: "web stack changed"`},
{t:[['Need','Use'],
['Restart only after a change','`notify` and a handler'],
['Run before a later task','`meta: flush_handlers`'],
['One event, several actions','`listen` topic'],
['Always restart (rare)','A normal task, not a handler']]},
{note:'Validate the configuration **before** the handler restarts a service (see `validate` above). A bad config plus an automatic restart is a classic outage.'}],
src:[['Handlers',UG+'playbooks_handlers.html']]};

/* ---------- 4: Tags ---------- */
L['ansible:4:4']={blocks:[
{p:'Large playbooks do many things. **Tags** are labels you attach to tasks so that you can run, or skip, just a part of the playbook without editing it.'},
{code:`- hosts: web
  become: true
  tasks:
    - name: Install packages
      ansible.builtin.package:
        name: [nginx, curl]
        state: present
      tags: [packages, setup]

    - name: Deploy configuration
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
      tags: [config]

    - name: Deploy application
      ansible.builtin.copy:
        src: app/
        dest: /var/www/app/
      tags: [deploy]`},
{code:`ansible-playbook site.yml --list-tags
ansible-playbook site.yml --tags config
ansible-playbook site.yml --tags "config,deploy"
ansible-playbook site.yml --skip-tags packages`},
{h:'Where tags can be set'},
{t:[['Level','Example','Effect'],
['Task','`tags: [config]`','That task'],
['Block','`block:` with `tags:`','All tasks in the block'],
['Play','`tags:` on the play','All tasks in the play'],
['Role use','`roles: [{role: web, tags: web}]`','All tasks in the role'],
['Imports','`import_tasks` with `tags`','Tasks inside the import']]},
{h:'Special tags'},
{t:[['Tag','Behaviour'],
['`always`','Runs unless explicitly skipped with `--skip-tags always`'],
['`never`','Runs only when requested by another tag it carries'],
['`tagged`, `untagged`, `all`','Selectors usable on the command line']]},
{code:`- name: Dangerous cleanup, runs only on request
  ansible.builtin.file:
    path: /var/cache/app
    state: absent
  tags: [never, cleanup]

# ansible-playbook site.yml --tags cleanup`},
{h:'Practical advice'},
{ul:['Use a small, agreed vocabulary: `packages`, `config`, `deploy`, `users`, `firewall`.','Tag facts or variable-setting tasks with `always` so partial runs still have what they need.','Tags make playbooks flexible but can hide dependencies. A run with `--tags config` assumes packages exist.','Include tasks (dynamic) do not inherit tags unless you apply them; import tasks (static) do.']},
{note:'Always check with `--list-tasks --tags yourtag` before running; it shows exactly which tasks will execute.'}],
src:[['Tags',UG+'playbooks_tags.html']]};

/* ---------- 5: Idempotent tasks ---------- */
L['ansible:4:5']={blocks:[
{p:'A reliable playbook can be run again and again with no side effects when nothing has to change. That property makes automation safe to schedule and easy to test.'},
{h:'The rule'},
{p:'**Module first, command last.** If a module exists for the job, use it. If you must use `command`, `shell` or `script`, tell Ansible how to detect that work is already done.'},
{h:'Checklist'},
{t:[['Check','Why'],
['A dedicated module exists?','Modules check state and report changed correctly'],
['Using `state:` explicitly?','Makes the intended end state obvious'],
['`command` has `creates` or `removes`?','Skips when the work is done'],
['Has `changed_when` for read-only commands?','Avoids false changed reports'],
['No `latest` on production packages?','Uncontrolled upgrades break repeatability'],
['Second run shows `changed=0`?','The test of idempotency'],
['Check mode works?','Allows safe preview']]},
{h:'Common fixes'},
{t:[['Anti-pattern','Better'],
['`shell: echo line >> file`','`lineinfile` with `regexp`'],
['`shell: useradd bob`','`user` module'],
['`command: wget url -O file`','`get_url` with `checksum`'],
['`shell: tar xf a.tgz`','`unarchive` with `creates`'],
['`command: systemctl restart app`','`service` plus a handler'],
['`shell: sed -i ...`','`replace` or `lineinfile` or a template']]},
{h:'Conditional actions with stat'},
{code:`- name: Check whether the app is installed
  ansible.builtin.stat:
    path: /opt/app/bin/app
  register: app_bin

- name: Install the application
  ansible.builtin.unarchive:
    src: app-1.4.tar.gz
    dest: /opt/app
  when: not app_bin.stat.exists`},
{h:'Honest change reporting'},
{code:`- name: Query the current version
  ansible.builtin.command: /opt/app/bin/app --version
  register: app_version
  changed_when: false        # a query never changes anything`},
{flow:['Write the task with a module','Run it twice on a lab host','Second run: changed=0?','If not, find the task that reports changed','Fix with state, creates or changed_when']},
{note:'Idempotent does not mean "never changes". It means the result is the same however many times you run it. After a manual edit on the host, the next run should repair it.'}],
src:[['Best practices',UG+'playbooks_best_practices.html']]};

/* ---------- 6: Practical web server ---------- */
L['ansible:4:6']={blocks:[
{p:'This practical combines modules, handlers, tags and a check of the result into one realistic playbook: a web server with a page, a firewall rule and a verification step.'},
{h:'Goal'},
{ul:['Install nginx on the `web` group.','Deploy an index page and a site configuration.','Open the firewall port for HTTP.','Verify the site answers with HTTP 200.']},
{h:'The playbook'},
{code:`# webserver.yml
- name: Web server
  hosts: web
  become: true
  vars:
    site_message: "Hello from {{ inventory_hostname }}"

  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present
      tags: [packages]

    - name: Deploy index page
      ansible.builtin.copy:
        content: "<h1>{{ site_message }}</h1>\\n"
        dest: /var/www/html/index.html
        owner: root
        group: root
        mode: "0644"
      tags: [content]

    - name: Deploy server configuration
      ansible.builtin.copy:
        src: files/default.conf
        dest: /etc/nginx/conf.d/default.conf
        mode: "0644"
      notify: Reload nginx
      tags: [config]

    - name: Enable and start nginx
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true
      tags: [service]

    - name: Open HTTP in firewalld (RedHat family)
      ansible.posix.firewalld:
        service: http
        permanent: true
        immediate: true
        state: enabled
      when: ansible_facts['os_family'] == "RedHat"
      tags: [firewall]

    - name: Open HTTP in ufw (Debian family)
      community.general.ufw:
        rule: allow
        port: "80"
        proto: tcp
      when: ansible_facts['os_family'] == "Debian"
      tags: [firewall]

    - name: Run handlers before verification
      ansible.builtin.meta: flush_handlers

    - name: Verify the site answers
      ansible.builtin.uri:
        url: http://localhost/
        status_code: 200
        return_content: true
      register: site
      failed_when: site_message not in site.content
      tags: [verify]

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded`},
{h:'Run it'},
{code:`ansible-galaxy collection install ansible.posix community.general
ansible-playbook webserver.yml --syntax-check
ansible-playbook webserver.yml --check --diff
ansible-playbook webserver.yml
ansible-playbook webserver.yml          # second run: expect changed=0
ansible-playbook webserver.yml --tags content`},
{h:'What to observe'},
{t:[['Run','Expected'],
['First run','Several tasks changed; handler runs once'],
['Second run','Everything ok, no handler'],
['Edit `site_message`, run again','Only the index page changes'],
['`--tags verify`','Only the verification runs']]},
{note:'Notice that verification is part of the playbook. Automation that checks its own result catches failures at deploy time instead of in production.'}],
src:[['Playbook tutorial',UG+'playbooks_intro.html'],['uri module',D+'collections/ansible/builtin/uri_module.html']]};
})();
