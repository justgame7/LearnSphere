/* LearnSphere - Ansible, Section 06: Variables, Facts & Templates.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,V=UG+'playbooks_variables.html';

/* ---------- diagrams ---------- */
const prec=K.dg(700,260,[
[10,10,680,240,'Simplified precedence: lower to higher',1],
[30,50,150,40,'role defaults',0],
[30,100,150,40,'inventory group_vars',0],
[30,150,150,40,'inventory host_vars',0],
[230,50,150,40,'facts, set_fact',0],
[230,100,150,40,'play vars, vars_files',0],
[230,150,150,40,'role vars',2],
[430,50,150,40,'task and block vars',0],
[430,100,150,40,'include_vars',0],
[430,150,150,40,'role and include params',0],
[430,200,150,40,'extra vars  -e',2]],
[[180,70,230,70],[180,120,230,120],[180,170,230,170],[380,70,430,70],[380,120,430,120],[380,170,430,170],[505,190,505,200]]);

const cacheFlow=K.dg(700,160,[
[10,10,680,140,'Fact caching',1],
[30,55,130,60,'Play starts|gather_facts',0],[210,55,150,60,'Cache fresh?|timeout not reached',2],[410,55,110,60,'Use cached|facts',0],[570,55,100,60,'Or run setup|and store',0]],
[[160,85,210,85],[360,70,410,70],[360,100,570,100]]);

const tplFlow=K.dg(700,160,[
[10,10,680,140,'The template module',1],
[30,55,140,60,'nginx.conf.j2|(on control node)',0],[220,55,140,60,'Jinja2 renders|variables, facts',2],[410,55,120,60,'Final text|per host',0],[580,55,90,60,'/etc/nginx|on target',2]],
[[170,85,220,85],[360,85,410,85],[530,85,580,85]]);

/* ---------- 0: Defining variables ---------- */
L['ansible:5:0']={blocks:[
{p:'Variables make one playbook serve many hosts and environments. Ansible lets you define them in many places; understanding the options lets you pick the right one.'},
{h:'Where variables come from'},
{t:[['Source','Example','Typical use'],
['Inventory file','`web1 http_port=8080`','A few host or group values'],
['`group_vars/` and `host_vars/`','`group_vars/web.yml`','Environment data (main place)'],
['Play `vars`','`vars:` in a play','Values local to one play'],
['`vars_files`','`vars_files: [vars/app.yml]`','Shared file of variables'],
['`vars_prompt`','Ask the user','Rare; interactive runs'],
['Role `defaults/` and `vars/`','Inside a role','Role interface (Section 8)'],
['Command line','`-e "version=1.2"`','Override for one run'],
['At run time','`register`, `set_fact`','Values computed during the play']]},
{code:`- hosts: web
  vars:
    app_name: shop
    app_port: 8080
    app_users:
      - alice
      - bob
    app_db:
      host: db1
      port: 5432
  vars_files:
    - vars/common.yml

  tasks:
    - name: Show some values
      ansible.builtin.debug:
        msg: "{{ app_name }} listens on {{ app_port }}, db {{ app_db.host }}:{{ app_db['port'] }}, first user {{ app_users[0] }}"`},
{h:'Naming rules'},
{ul:['Letters, numbers and underscores; **must not start with a digit**.','Do not use Python or Ansible reserved words, for example `environment`, `name`, `hosts`.','Use clear prefixes for role variables, such as `nginx_port`.','Prefer `snake_case` and descriptive names over short ones.']},
{h:'Referencing'},
{t:[['Data','Syntax','Note'],
['Simple value','`{{ var }}`','Quote the whole value if it starts with braces'],
['Dictionary key','`{{ d.key }}` or `{{ d["key"] }}`','Brackets work for any key name'],
['List item','`{{ list[0] }}`','Zero based'],
['Default','`{{ var | default("x") }}`','Avoids undefined errors']]},
{h:'Command-line variables'},
{code:`ansible-playbook site.yml -e "app_port=9090 env=staging"
ansible-playbook site.yml -e @overrides.yml          # from a file
ansible-playbook site.yml -e '{"debug": true}'      # JSON`},
{note:'Extra variables (`-e`) win over everything else. Use them for one-time overrides and for pipeline parameters, not as a permanent way to configure hosts.'}],
src:[['Using variables',V]]};

/* ---------- 1: Precedence ---------- */
L['ansible:5:1']={blocks:[
{p:'The same variable can be set in several places. Ansible has a fixed **precedence** order that decides which value is used. You do not need to memorise all 22 levels, only the shape and a few rules.'},
{svg:prec},
{h:'The order, from lowest to highest'},
{t:[['#','Level','Typical location'],
['1','Command-line values (not `-e`)','`-u`, `-c` options'],
['2','Role defaults','`roles/x/defaults/main.yml`'],
['3','Inventory file group vars','`[web:vars]`'],
['4','Inventory `group_vars/all`','Beside inventory'],
['5','Playbook `group_vars/all`','Beside playbook'],
['6','Inventory `group_vars/*`','Beside inventory'],
['7','Playbook `group_vars/*`','Beside playbook'],
['8','Inventory file host vars','`web1 port=1`'],
['9','Inventory `host_vars/*`','Beside inventory'],
['10','Playbook `host_vars/*`','Beside playbook'],
['11','Host facts and cached set_fact','Gathered facts'],
['12','Play `vars`','In the play'],
['13','Play `vars_prompt`','Interactive'],
['14','Play `vars_files`','Files listed in the play'],
['15','Role `vars`','`roles/x/vars/main.yml`'],
['16','Block `vars`','Only for tasks in the block'],
['17','Task `vars`','Only for the task'],
['18','`include_vars`','Loaded in a task'],
['19','`set_fact` and `register`','Created at run time'],
['20','Role (and `include_role`) params','Arguments passed to a role'],
['21','`include` params','Arguments passed to an include'],
['22','Extra vars `-e`','Command line, always wins']]},
{h:'Practical rules'},
{ul:['Put **defaults** low (role `defaults/`) so users can override them.','Put **environment data** in `group_vars`, **exceptions** in `host_vars`.','Avoid defining the same variable at many levels; people lose time hunting.','Use **different names** for different concepts instead of relying on precedence tricks.','Use `-e` only for deliberate one-off overrides.']},
{h:'Debugging a value'},
{flow:['Print the variable with debug','Check ansible-inventory --host for inventory-level values','Search the repo for the variable name','Check role defaults, vars and play vars','Run with -vvv to see where it is loaded from']},
{note:'Merging: by default a dictionary variable defined twice is **replaced**, not merged. Use the `combine` filter or `hash_behaviour` knowingly if you need a merge.'}],
src:[['Variable precedence',V+'#understanding-variable-precedence']]};

/* ---------- 2: Facts ---------- */
L['ansible:5:2']={blocks:[
{p:'You met gathered facts in Section 4. Here you will go further: add **custom facts** that live on the managed node, and **cache** facts so large runs do not rediscover everything each time.'},
{h:'Three kinds of facts'},
{t:[['Kind','Source','Where you read it'],
['**Gathered**','`setup` module at play start','`ansible_facts[...]`'],
['**Custom (local)**','Files in `/etc/ansible/facts.d/` on the host','`ansible_local`'],
['**Set during the run**','`set_fact`','As a normal variable']]},
{h:'Custom facts'},
{p:'Any file ending in `.fact` in `/etc/ansible/facts.d/` is read on gather. It can be INI or JSON, or an executable that prints JSON.'},
{code:`# /etc/ansible/facts.d/app.fact   (INI format)
[general]
tier=web
owner=platform-team
build=1423`},
{code:`# create it with Ansible
- name: Create the facts directory
  ansible.builtin.file:
    path: /etc/ansible/facts.d
    state: directory
    mode: "0755"

- name: Install a custom fact
  ansible.builtin.copy:
    src: app.fact
    dest: /etc/ansible/facts.d/app.fact
    mode: "0644"

- name: Re-read facts
  ansible.builtin.setup:
    filter: ansible_local

- name: Use it
  ansible.builtin.debug:
    msg: "Tier is {{ ansible_local['app']['general']['tier'] }}"`},
{h:'Fact caching'},
{svg:cacheFlow},
{code:`# ansible.cfg
[defaults]
gathering = smart                   # gather only if not cached
fact_caching = jsonfile
fact_caching_connection = ~/.ansible/fact_cache
fact_caching_timeout = 3600         # seconds`},
{t:[['Setting','Value','Effect'],
['`gathering`','`implicit`','Always gather (default)'],
['`gathering`','`smart`','Gather once, reuse from cache'],
['`gathering`','`explicit`','Gather only when `gather_facts: true` is set'],
['`fact_caching`','`jsonfile`, `redis`, `memory`','Where facts are stored']]},
{h:'When to skip or cache'},
{ul:['Short playbooks that use no facts: `gather_facts: false`.','Large fleets with frequent runs: cache facts and use `gathering = smart`.','If you rely on very fresh values (free memory, disk), gather in that play.']},
{note:'Cached facts can be stale. Do not use them for decisions that need current values, and keep `fact_caching_timeout` short in changing environments.'}],
src:[['Facts and magic variables',UG+'playbooks_vars_facts.html'],['Caching facts',UG+'playbooks_vars_facts.html#caching-facts']]};

/* ---------- 3: register and set_fact ---------- */
L['ansible:5:3']={blocks:[
{p:'Sometimes a value only exists once a task has run. **register** captures a task result into a variable; **set_fact** creates a new variable from computed data.'},
{h:'register'},
{code:`- name: Look up the application version
  ansible.builtin.command: /opt/app/bin/app --version
  register: app_version
  changed_when: false

- name: Show the whole result while learning
  ansible.builtin.debug:
    var: app_version

- name: Use one part
  ansible.builtin.debug:
    msg: "Version is {{ app_version.stdout }}"`},
{h:'What a registered result contains'},
{t:[['Key','Meaning','Present for'],
['`stdout`, `stdout_lines`','Output as string or list of lines','command, shell'],
['`stderr`','Error output','command, shell'],
['`rc`','Return code','command, shell'],
['`changed`, `failed`, `skipped`','Task state flags','All modules'],
['`msg`','Message','Many modules'],
['`results`','List of per-item results','Tasks with loops'],
['Module specific','`stat.exists`, `content`, ...','Depends on module']]},
{h:'Using the result in a condition'},
{code:`- name: Check for a marker file
  ansible.builtin.stat:
    path: /etc/app/.configured
  register: marker

- name: Configure only the first time
  ansible.builtin.command: /opt/app/bin/configure
  when: not marker.stat.exists`},
{h:'set_fact'},
{code:`- name: Calculate values once
  ansible.builtin.set_fact:
    heap_mb: "{{ (ansible_facts['memtotal_mb'] * 0.25) | int }}"
    app_url: "https://{{ inventory_hostname }}:{{ app_port }}/"

- name: Use them later in the play
  ansible.builtin.debug:
    msg: "Heap {{ heap_mb }} MB, url {{ app_url }}"`},
{h:'register vs set_fact'},
{t:[['','register','set_fact'],
['Purpose','Capture a task result','Create or compute a variable'],
['Scope','Current play run on that host','Same, and can be cached with `cacheable: true`'],
['Type','Structure from the module','Whatever you assign']]},
{h:'Tips'},
{ul:['Debug the full registered variable once to learn its shape.','Registered variables exist even when a task is skipped; check `is skipped` or use `default`.','Do not overuse `set_fact` to hide business logic; define variables declaratively where possible.']},
{note:'Values created with `set_fact` and `register` belong to a host. They are not shared automatically with other hosts; read them through `hostvars` (lecture 6).'}],
src:[['Registering variables',UG+'playbooks_variables.html#registering-variables'],['set_fact',D+'collections/ansible/builtin/set_fact_module.html']]};

/* ---------- 4: Jinja2 ---------- */
L['ansible:5:4']={blocks:[
{p:'**Jinja2** is the templating language Ansible uses for everything inside `{{ }}`. Expressions, filters and tests let you transform data without writing code in a custom module.'},
{h:'Three delimiters'},
{t:[['Syntax','Purpose'],
['`{{ expression }}`','Print a value'],
['`{% statement %}`','Control: loops, conditions (templates only)'],
['`{# comment #}`','Comment, not output']]},
{h:'Expressions'},
{code:`{{ app_port + 1 }}
{{ "web-" ~ env }}                 # ~ joins strings
{{ ansible_facts['hostname'] | upper }}
{{ users | length }}
{{ (a > b) | ternary("yes", "no") }}`},
{h:'Filters worth knowing'},
{t:[['Filter','Example','Result'],
['`default`','`{{ port | default(80) }}`','80 when undefined'],
['`mandatory`','`{{ port | mandatory }}`','Fails if undefined'],
['`join`','`{{ list | join(",") }}`','a,b,c'],
['`split`','`{{ "a,b" | split(",") }}`','list'],
['`map`','`{{ users | map(attribute="name") | list }}`','list of names'],
['`select` / `reject`','`{{ nums | select("gt", 5) | list }}`','filtered list'],
['`selectattr`','`{{ svcs | selectattr("enabled") | list }}`','filtered dicts'],
['`unique`, `sort`','`{{ items | unique | sort }}`','clean list'],
['`combine`','`{{ defaults | combine(overrides) }}`','merged dict'],
['`dict2items`','`{{ d | dict2items }}`','list of key and value'],
['`regex_replace`','`{{ s | regex_replace("^v","") }}`','string changed'],
['`to_nice_json`, `to_nice_yaml`','`{{ cfg | to_nice_yaml }}`','formatted text'],
['`int`, `bool`, `string`','`{{ "8" | int }}`','type conversion'],
['`quote`','`{{ path | quote }}`','Shell-safe string']]},
{h:'Tests'},
{p:'A **test** answers a yes or no question. Write them with `is`.'},
{code:`when: result is succeeded
when: item is defined
when: path is file
when: ansible_facts['distribution_version'] is version('22.04', '>=')
when: name is match("^web")
when: "'nginx' in packages"`},
{t:[['Test','Meaning'],
['`defined`, `undefined`, `none`','Variable presence'],
['`succeeded`, `failed`, `changed`, `skipped`','Result of a registered task'],
['`string`, `number`, `mapping`, `iterable`','Type'],
['`match`, `search`','Regular expression'],
['`version`','Version comparison'],
['`in`','Membership']]},
{note:'In a `when:` condition you do **not** use `{{ }}`. Write `when: app_port == 80`. Using braces there produces a warning and is a common beginner mistake.'}],
src:[['Templating (Jinja2)',UG+'playbooks_templating.html'],['Filters',UG+'playbooks_filters.html'],['Tests',UG+'playbooks_tests.html']]};

/* ---------- 5: template module ---------- */
L['ansible:5:5']={blocks:[
{p:'The `template` module renders a Jinja2 file on the control node using the variables of each host and copies the result to the target. It is the standard way to manage configuration files.'},
{svg:tplFlow},
{h:'The task'},
{code:`- name: Deploy the nginx configuration
  ansible.builtin.template:
    src: nginx.conf.j2
    dest: /etc/nginx/nginx.conf
    owner: root
    group: root
    mode: "0644"
    backup: true
    validate: "nginx -t -c %s"
  notify: Reload nginx`},
{h:'A template'},
{code:`# templates/nginx.conf.j2
# {{ ansible_managed }}
worker_processes {{ ansible_facts['processor_vcpus'] }};

events {
    worker_connections {{ worker_connections | default(1024) }};
}

http {
{% for site in sites %}
    server {
        listen {{ site.port | default(80) }};
        server_name {{ site.name }};
{% if site.tls | default(false) %}
        ssl_certificate /etc/ssl/{{ site.name }}.crt;
{% endif %}
        root {{ site.root }};
    }
{% endfor %}
}`},
{h:'Useful template features'},
{t:[['Feature','Use'],
['`{{ ansible_managed }}`','Warning comment: do not edit by hand'],
['`{% for %}` / `{% if %}`','Generate repeated or conditional sections'],
['`{{ var | default(x) }}`','Safe defaults'],
['`{%- ... -%}`','Strip surrounding whitespace'],
['`trim_blocks`, `lstrip_blocks`','Module options to tidy blank lines'],
['`validate`','Check the rendered file before installing it'],
['`backup`','Keep a timestamped copy of the old file']]},
{h:'Process'},
{flow:['Write the .j2 file under templates/','Set variables in group_vars or host_vars','Run with --check --diff to review the rendered result','Apply; handler reloads the service only if the file changed']},
{h:'Common mistakes'},
{ul:['**Editing the generated file** on the host: the next run overwrites it. Change the template instead.','Missing `default`: an undefined variable aborts the run with an error. That can be good (`mandatory`), but be deliberate.','Stray blank lines from `{% %}` lines: use the whitespace controls or `trim_blocks`.','Using `copy` with `content` for large configs: move to a template.']},
{note:'Keep logic in templates simple. If a template needs heavy computation, compute a variable first with `set_fact` or a filter, then print it.'}],
src:[['template',D+'collections/ansible/builtin/template_module.html'],['Templating',UG+'playbooks_templating.html']]};

/* ---------- 6: Magic variables ---------- */
L['ansible:5:6']={blocks:[
{p:'Ansible provides variables about the run, the inventory and other hosts. These **magic variables** are read only, and they are how a play on one host can use information about another.'},
{h:'The most useful ones'},
{t:[['Variable','Content','Example use'],
['`inventory_hostname`','Name of the current host in the inventory','Unique file names'],
['`inventory_hostname_short`','Name up to the first dot','Short names'],
['`group_names`','List of groups the host belongs to','`"web" in group_names`'],
['`groups`','Dictionary of all groups and their hosts','Loop over db hosts'],
['`hostvars`','Variables of every host','Read another host fact'],
['`ansible_play_hosts`','Hosts still active in the current play','Counting survivors'],
['`play_hosts` (old)','Replaced by the above','Avoid'],
['`inventory_dir`, `playbook_dir`','Paths','Relative file lookups'],
['`ansible_check_mode`','True in check mode','Skip risky tasks'],
['`ansible_version`','Ansible version data','Compatibility checks']]},
{h:'Using groups and hostvars'},
{code:`# in a template: list all database servers as a connection string
{% for host in groups['db'] %}
server {{ hostvars[host]['ansible_facts']['default_ipv4']['address'] }}:5432;
{% endfor %}

# in a task
- name: Show who is in the web group
  ansible.builtin.debug:
    msg: "{{ groups['web'] | join(', ') }}"

- name: Run only on hosts in both groups
  ansible.builtin.debug:
    msg: "I am a prod web server"
  when: "'web' in group_names and 'prod' in group_names"`},
{h:'A requirement to remember'},
{p:'`hostvars[host]` only contains facts of a host if facts have **already been gathered** for it in this run (or are cached). If a play targets only `web`, facts for `db` are not available unless an earlier play gathered them.'},
{code:`- name: Gather facts about db hosts first
  hosts: db
  tasks: []

- name: Configure web using db facts
  hosts: web
  tasks:
    - name: Show a db address
      ansible.builtin.debug:
        msg: "{{ hostvars[groups['db'][0]]['ansible_facts']['default_ipv4']['address'] }}"`},
{note:'Do not try to **set** magic variables; they are managed by Ansible. Names such as `groups`, `hostvars` and `inventory_hostname` are reserved.'}],
src:[['Special variables',D+'reference_appendices/special_variables.html']]};

/* ---------- 7: Practical template per env ---------- */
L['ansible:5:7']={blocks:[
{p:'This practical combines **group_vars**, **facts** and a **template** to produce an Nginx virtual host that differs per environment from one template and one playbook.'},
{h:'Layout'},
{code:`project/
  inventory/
    hosts.yml
    group_vars/
      all.yml
      dev.yml
      prod.yml
  templates/
    vhost.conf.j2
  site.yml`},
{h:'Variables'},
{code:`# group_vars/all.yml
vhost_name: shop.example.com
vhost_root: /var/www/shop
worker_connections: 1024

# group_vars/dev.yml
env: dev
vhost_port: 8080
enable_tls: false
access_log: debug

# group_vars/prod.yml
env: prod
vhost_port: 443
enable_tls: true
access_log: combined
tls_cert: /etc/ssl/shop.crt
tls_key: /etc/ssl/shop.key`},
{h:'Template'},
{code:`# templates/vhost.conf.j2
# {{ ansible_managed }}
# environment: {{ env }}  host: {{ inventory_hostname }}
server {
    listen {{ vhost_port }}{% if enable_tls %} ssl{% endif %};
    server_name {{ vhost_name }};
    root {{ vhost_root }};
{% if enable_tls %}
    ssl_certificate     {{ tls_cert }};
    ssl_certificate_key {{ tls_key }};
{% endif %}
    access_log /var/log/nginx/{{ vhost_name }}.access.log {{ access_log }};
    # workers sized by CPU count on this host
    # cpus: {{ ansible_facts['processor_vcpus'] }}
}`},
{h:'Playbook'},
{code:`# site.yml
- name: Nginx virtual host
  hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.package:
        name: nginx
        state: present

    - name: Render the virtual host
      ansible.builtin.template:
        src: vhost.conf.j2
        dest: "/etc/nginx/conf.d/{{ vhost_name }}.conf"
        mode: "0644"
      notify: Reload nginx

    - name: Test the nginx configuration
      ansible.builtin.command: nginx -t
      changed_when: false

    - name: Ensure nginx runs
      ansible.builtin.service:
        name: nginx
        state: started
        enabled: true

  handlers:
    - name: Reload nginx
      ansible.builtin.service:
        name: nginx
        state: reloaded`},
{h:'Run and compare'},
{code:`ansible-playbook -i inventory/hosts.yml site.yml --limit dev  --check --diff
ansible-playbook -i inventory/hosts.yml site.yml --limit prod --check --diff
ansible-inventory -i inventory/hosts.yml --host web-prod-01`},
{t:[['Check','Expected'],
['Dev diff','listen 8080, no ssl lines, access log format debug'],
['Prod diff','listen 443 ssl, certificate lines, combined log'],
['Second run','No changes in either environment']]},
{note:'The lesson: environment differences are **data**, not copies of playbooks. One template and one playbook, driven by group_vars, keep dev and prod structurally identical.'}],
src:[['Templating',UG+'playbooks_templating.html'],['Variables',V]]};
})();
