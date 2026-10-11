/* LearnSphere - Ansible, Section 08: Roles & Reusability.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,R=UG+'playbooks_reuse_roles.html';

/* ---------- diagrams ---------- */
const reuse=K.dg(700,230,[
[10,10,680,210,'One role, many playbooks',1],
[30,60,150,50,'Playbook: web tier',0],[30,130,150,50,'Playbook: db tier',0],
[260,70,160,90,'role: common|users, ntp,|ssh baseline',2],
[500,50,170,45,'Variables for web',0],[500,115,170,45,'Variables for db',0]],
[[180,85,260,100],[180,155,260,130],[500,72,420,100],[500,138,420,130]]);

const layout=K.dg(700,260,[
[10,10,680,240,'roles/webserver/',1],
[30,45,150,36,'tasks/main.yml',2],[30,90,150,36,'handlers/main.yml',0],[30,135,150,36,'defaults/main.yml',2],[30,180,150,36,'vars/main.yml',0],
[250,45,150,36,'templates/*.j2',0],[250,90,150,36,'files/',0],[250,135,150,36,'meta/main.yml',0],[250,180,150,36,'README.md',0],
[470,45,200,36,'library, module_utils',0],[470,90,200,36,'lookup_plugins, filter_plugins',0],[470,135,200,36,'tests/ or molecule/',0]],
[]);

const depFlow=K.dg(700,150,[
[10,10,680,130,'Dependency order',1],
[30,55,150,55,'common|(dependency)',0],[230,55,150,55,'firewall|(dependency)',0],[430,55,150,55,'webserver|(the role)',2],[610,55,70,55,'Tasks',0]],
[[180,82,230,82],[380,82,430,82],[580,82,610,82]]);

/* ---------- 0: Why roles ---------- */
L['ansible:7:0']={blocks:[
{p:'A single playbook is fine for a handful of tasks. As the work grows it becomes a long file, copied between projects, with variables and templates scattered around. A **role** is Ansible\'s unit of reuse: a folder with a fixed structure that bundles tasks, defaults, templates and handlers for one purpose.'},
{svg:reuse},
{h:'What roles give you'},
{t:[['Benefit','Meaning'],
['**Structure**','Everyone knows where tasks, templates and variables live'],
['**Reuse**','Use the same role for many hosts, playbooks and projects'],
['**Clear interface**','Variables in `defaults/` document what can be configured'],
['**Sharing**','Publish to Galaxy or Git, version and pin'],
['**Testability**','A role is a natural unit for Molecule tests (Section 12)']]},
{h:'Before and after'},
{code:`# before: everything in one file
- hosts: web
  tasks:
    - ... 40 tasks for nginx, tls, logging, users ...

# after: the playbook becomes a readable summary
- hosts: web
  become: true
  roles:
    - common
    - nginx
    - { role: app, app_port: 8080 }`},
{h:'When a role is worth it'},
{t:[['Create a role when','Do not bother when'],
['You will use the logic in two or more places','It is a one-off task list'],
['The logic has its own variables and templates','The playbook is 10 lines'],
['You want to test or version it separately','Splitting would only add folders'],
['Another team should be able to consume it','The logic is specific to one playbook']]},
{note:'Do not start by designing roles. Write a working playbook, notice repetition, then extract a role. Premature roles tend to have the wrong boundaries.'}],
src:[['Roles',R]]};

/* ---------- 1: Role layout ---------- */
L['ansible:7:1']={blocks:[
{p:'A role is a directory with a standard set of subdirectories. Ansible loads certain files **automatically**, so you do not import them yourself.'},
{svg:layout},
{code:`roles/
  webserver/
    tasks/main.yml
    handlers/main.yml
    defaults/main.yml
    vars/main.yml
    templates/nginx.conf.j2
    files/index.html
    meta/main.yml
    README.md`},
{h:'What each directory is for'},
{t:[['Directory','Contents','Loaded automatically'],
['`tasks/`','The list of tasks the role performs','`main.yml`'],
['`handlers/`','Handlers notified by the tasks','`main.yml`'],
['`defaults/`','Default variable values; lowest precedence, easy to override','`main.yml`'],
['`vars/`','Internal variables; high precedence, not meant to be overridden','`main.yml`'],
['`templates/`','Jinja2 templates for the `template` module','Found by name'],
['`files/`','Static files for `copy` and `script`','Found by name'],
['`meta/`','Role metadata and dependencies','`main.yml`'],
['`library/`, `module_utils/`','Custom modules and helpers inside the role','Found automatically'],
['`*_plugins/`','Filters, lookups and so on','Found automatically']]},
{h:'Path rules'},
{ul:['Inside a role, `template: src: nginx.conf.j2` is found in the role `templates/` directory without a path.','`copy: src: index.html` is found in `files/`.','A `tasks/` directory may contain more files; `main.yml` includes them with `import_tasks` or `include_tasks`.','Only the directories you need have to exist.']},
{h:'Splitting tasks'},
{code:`# roles/webserver/tasks/main.yml
- name: Install packages
  ansible.builtin.import_tasks: install.yml

- name: Configure
  ansible.builtin.import_tasks: configure.yml

- name: Manage service
  ansible.builtin.import_tasks: service.yml`},
{note:'Keep `main.yml` as a small table of contents. A reader should see the shape of the role in 10 lines.'}],
src:[['Role directory structure',R+'#role-directory-structure']]};

/* ---------- 2: ansible-galaxy init ---------- */
L['ansible:7:2']={blocks:[
{p:'`ansible-galaxy role init` scaffolds the standard layout so you do not have to create folders by hand. This lecture creates a role, moves tasks into it and calls it.'},
{h:'Create the role'},
{code:`cd roles
ansible-galaxy role init webserver
# - Role webserver was created successfully

tree webserver
# webserver/
#   README.md
#   defaults/main.yml
#   files/
#   handlers/main.yml
#   meta/main.yml
#   tasks/main.yml
#   templates/
#   tests/
#   vars/main.yml`},
{h:'Move tasks into it'},
{p:'Take the tasks from the playbook in Section 5 and place them in the role. Hard-coded values become defaults.'},
{code:`# roles/webserver/defaults/main.yml
webserver_package: nginx
webserver_port: 80
webserver_message: "Hello from {{ inventory_hostname }}"

# roles/webserver/tasks/main.yml
- name: Install nginx
  ansible.builtin.package:
    name: "{{ webserver_package }}"
    state: present

- name: Deploy index page
  ansible.builtin.template:
    src: index.html.j2
    dest: /var/www/html/index.html
    mode: "0644"

- name: Enable and start the service
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true`},
{code:`# roles/webserver/templates/index.html.j2
<h1>{{ webserver_message }}</h1>`},
{h:'Call it from a playbook'},
{code:`# site.yml
- name: Web tier
  hosts: web
  become: true
  roles:
    - role: webserver
      webserver_message: "Production web"`},
{flow:['ansible-galaxy role init name','Move tasks, templates, files and handlers into place','Turn hard-coded values into defaults','Write the README with variables and an example','Call the role from a playbook and test twice']},
{h:'Role search path'},
{p:'Ansible looks for roles in a `roles/` directory next to the playbook, then in `roles_path` from ansible.cfg and finally in the system location. Set `roles_path = ./roles` in project configuration to make it explicit.'},
{note:'Delete the files you do not need from the scaffold (for example `tests/` if you use Molecule, and `vars/main.yml` if empty). An empty file is noise.'}],
src:[['ansible-galaxy',K.CLI+'ansible-galaxy.html'],['Creating roles',D+'galaxy/dev_guide.html']]};

/* ---------- 3: Using roles ---------- */
L['ansible:7:3']={blocks:[
{p:'There are three ways to use a role. They differ in **when** Ansible reads the role and in what you can do with conditions and loops.'},
{t:[['Method','Style','When processed','Use for'],
['`roles:` in a play','Classic','At the start of the play, before `tasks`','Simple, most common'],
['`import_role`','Static','When the playbook is parsed','Predictable, tags and `--list-tasks` work'],
['`include_role`','Dynamic','When execution reaches it','Loops, conditions, runtime variables']]},
{code:`# 1. classic
- hosts: web
  roles:
    - common
    - role: nginx
      nginx_port: 8080

# 2. static import inside tasks
- hosts: web
  tasks:
    - name: Apply the baseline
      ansible.builtin.import_role:
        name: common

# 3. dynamic include with a condition and a loop
- hosts: web
  tasks:
    - name: Apply the TLS role only in production
      ansible.builtin.include_role:
        name: tls
      when: env == "prod"

    - name: Deploy several apps
      ansible.builtin.include_role:
        name: app
      vars:
        app_name: "{{ item }}"
      loop: [shop, blog]`},
{h:'Passing parameters'},
{ul:['`roles:` entries and `vars:` on import or include provide values for the role variables.','Role parameters sit **high** in the precedence order, above play variables.','Use the role own prefix (`nginx_port`) so parameters do not clash.']},
{h:'Running part of a role'},
{code:`- name: Run only the install tasks of the role
  ansible.builtin.include_role:
    name: nginx
    tasks_from: install.yml`},
{h:'Ordering inside a play'},
{flow:['pre_tasks','roles (in listed order, with their dependencies)','tasks (and import_role or include_role inside them)','post_tasks','Handlers at the end of each section']},
{h:'Tags and conditions'},
{ul:['With `import_role` the `when` and `tags` are copied onto **every task** inside the role.','With `include_role` they apply to the include **itself**; use `apply:` to pass tags to the inner tasks.','`--list-tasks` and `--list-tags` show imported roles, but not included ones.']},
{code:`- ansible.builtin.include_role:
    name: nginx
    apply:
      tags: [web]
  tags: [web]`},
{note:'Default to the plain `roles:` section or `import_role`. Choose `include_role` only when you need a runtime condition, a loop or a computed role name.'}],
src:[['Re-using playbooks',UG+'playbooks_reuse.html'],['include_role',D+'collections/ansible/builtin/include_role_module.html']]};

/* ---------- 4: defaults vs vars ---------- */
L['ansible:7:4']={blocks:[
{p:'A role has two places for variables with very different meanings. Choosing correctly makes a role easy to configure and hard to break.'},
{t:[['','`defaults/main.yml`','`vars/main.yml`'],
['Precedence','Lowest of all','High, above inventory and play vars'],
['Intended use','**Public interface**: values users may change','**Internal constants**: values users should not change'],
['Overridable','Easily, from inventory, group_vars or play','Only by extra vars or very high levels'],
['Examples','`nginx_port`, `app_version`','Package name map per OS, paths the role depends on']]},
{h:'Design the interface'},
{code:`# roles/nginx/defaults/main.yml  - documented, safe values
nginx_port: 80
nginx_worker_connections: 1024
nginx_server_tokens: false
nginx_sites: []

# roles/nginx/vars/main.yml     - internal, per OS family
nginx_service_name: nginx
nginx_conf_dir: /etc/nginx`},
{h:'Naming and hygiene'},
{ul:['**Prefix every variable** with the role name: `nginx_port`, not `port`. All roles share one variable namespace.','Document each variable in the README: name, default, meaning, example.','Provide a sensible default for everything optional; require only what must be given.','Validate required input at the top of the role with `assert` or `argument_specs`.','Do not read variables from other roles unless it is a documented dependency.']},
{h:'argument_specs: a machine-checked interface'},
{code:`# roles/nginx/meta/argument_specs.yml
argument_specs:
  main:
    short_description: Install and configure nginx
    options:
      nginx_port:
        type: int
        default: 80
        description: Port to listen on
      nginx_sites:
        type: list
        elements: dict
        default: []
        description: Virtual hosts to create`},
{p:'With an argument spec, Ansible validates input before running any task and gives a clear error for wrong types or missing required options. It also feeds `ansible-doc` for the role.'},
{note:'A common mistake is putting everything in `vars/`. Users then cannot override it from inventory and resort to `-e`, which is exactly what roles should avoid.'}],
src:[['Role argument validation',R+'#role-argument-validation'],['Variable precedence',UG+'playbooks_variables.html#variable-precedence-where-should-i-put-a-variable']]};

/* ---------- 5: Dependencies ---------- */
L['ansible:7:5']={blocks:[
{p:'A role can declare that it needs other roles to run first. These are **dependencies**, written in `meta/main.yml`.'},
{svg:depFlow},
{code:`# roles/webserver/meta/main.yml
dependencies:
  - role: common
  - role: firewall
    vars:
      firewall_open_ports: [80, 443]

galaxy_info:
  author: platform-team
  description: Web server role
  license: MIT
  min_ansible_version: "2.15"
  platforms:
    - name: EL
      versions: ["9"]
    - name: Ubuntu
      versions: ["22.04", "24.04"]`},
{h:'How they run'},
{ul:['Dependencies run **before** the role that lists them, in the order listed.','A dependent role runs **once** per play even if several roles depend on it, unless its meta sets `allow_duplicates: true` or it is given different parameters.','Variables given in the dependency entry become role parameters for it.']},
{h:'Risks'},
{t:[['Risk','What happens','Alternative'],
['**Hidden coupling**','Using a role pulls in others you did not expect','List the roles in the playbook so the order is visible'],
['**Surprising defaults**','A dependency changes shared state (firewall, packages)','Keep it explicit and documented'],
['**Deep chains**','Debugging order and variables becomes hard','Keep dependencies shallow'],
['**Circular dependencies**','Role A needs B needs A','Extract shared code into a third role']]},
{h:'Rule of thumb'},
{p:'Use dependencies for small, **technical prerequisites** that a role cannot work without (for example a role that installs a repository). Use the playbook `roles:` list for **business ordering**, where the intent should be visible to the reader.'},
{code:`# explicit and readable in the playbook
- hosts: web
  roles:
    - common
    - firewall
    - webserver`},
{note:'A role consumed by other teams should declare its true dependencies, including collection requirements, in `meta/` so installation tools can resolve them.'}],
src:[['Role dependencies',R+'#role-dependencies']]};

/* ---------- 6: Galaxy ---------- */
L['ansible:7:6']={blocks:[
{p:'**Ansible Galaxy** is the public hub for sharing roles and collections. The `ansible-galaxy` command installs content from Galaxy, from Git repositories or from a private hub. A **requirements file** makes installations reproducible.'},
{h:'Install content'},
{code:`ansible-galaxy role install geerlingguy.nginx
ansible-galaxy role install geerlingguy.nginx -p ./roles
ansible-galaxy role list
ansible-galaxy collection install community.general`},
{h:'requirements.yml'},
{code:`# requirements.yml
roles:
  - name: geerlingguy.nginx
    version: "3.2.0"
  - name: internal_hardening
    src: https://git.example.com/platform/ansible-role-hardening.git
    scm: git
    version: v1.4.2

collections:
  - name: ansible.posix
    version: ">=1.5.0,<2.0.0"
  - name: community.general
    version: "9.0.1"`},
{code:`ansible-galaxy install -r requirements.yml -p ./roles
ansible-galaxy collection install -r requirements.yml -p ./collections`},
{h:'Pin versions'},
{t:[['Practice','Why'],
['Pin exact versions or a safe range','A new upstream release should not change production behaviour overnight'],
['Install into the project (`-p`)','Keeps content out of the system and in sync with the repository'],
['Commit `requirements.yml`, not the content','Small repository, reproducible installs'],
['Review changes when bumping','Read the changelog; run tests first']]},
{h:'Using a private hub'},
{code:`# ansible.cfg
[galaxy]
server_list = automation_hub, release_galaxy

[galaxy_server.automation_hub]
url = https://hub.example.com/api/galaxy/content/published/
token = <your token>

[galaxy_server.release_galaxy]
url = https://galaxy.ansible.com/`},
{h:'Judging third-party content'},
{ul:['Prefer content from known maintainers or vendors, with recent releases and tests.','Read the tasks before you run them as root on your servers.','Fork or vendor critical roles you depend on and review updates.']},
{note:'Treat content from Galaxy like any dependency: it runs with your privileges. Pin, review and scan it as part of your supply chain.'}],
src:[['Galaxy user guide',K.GAL+'user_guide.html'],['Installing roles and collections from files',K.GAL+'user_guide.html#installing-roles-and-collections-from-the-same-requirements-yml-file']]};

/* ---------- 7: Practical hardening role ---------- */
L['ansible:7:7']={blocks:[
{p:'In this practical you build a small but real role, **hardening**, and apply it to two groups with different settings: stricter for production, lighter for development.'},
{h:'Defaults (the interface)'},
{code:`# roles/hardening/defaults/main.yml
hardening_ssh_permit_root_login: "no"
hardening_ssh_password_auth: "no"
hardening_ssh_max_auth_tries: 4
hardening_banner_text: "Authorised use only. Activity is logged."
hardening_packages_absent: [telnet, rsh-client]
hardening_packages_present: [fail2ban]
hardening_sysctl:
  net.ipv4.ip_forward: 0
  net.ipv4.conf.all.accept_redirects: 0
  kernel.randomize_va_space: 2`},
{h:'Tasks'},
{code:`# roles/hardening/tasks/main.yml
- name: Configure sshd settings
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: "^#?{{ item.key }}\\\\b"
    line: "{{ item.key }} {{ item.value }}"
    validate: "sshd -t -f %s"
  loop:
    - { key: PermitRootLogin, value: "{{ hardening_ssh_permit_root_login }}" }
    - { key: PasswordAuthentication, value: "{{ hardening_ssh_password_auth }}" }
    - { key: MaxAuthTries, value: "{{ hardening_ssh_max_auth_tries }}" }
  loop_control:
    label: "{{ item.key }}"
  notify: Restart sshd

- name: Install a login banner
  ansible.builtin.copy:
    content: "{{ hardening_banner_text }}\\n"
    dest: /etc/issue.net
    mode: "0644"

- name: Remove insecure packages
  ansible.builtin.package:
    name: "{{ hardening_packages_absent }}"
    state: absent

- name: Install protection packages
  ansible.builtin.package:
    name: "{{ hardening_packages_present }}"
    state: present

- name: Apply kernel settings
  ansible.posix.sysctl:
    name: "{{ item.key }}"
    value: "{{ item.value }}"
    sysctl_set: true
    reload: true
  loop: "{{ hardening_sysctl | dict2items }}"
  loop_control:
    label: "{{ item.key }}"`},
{code:`# roles/hardening/handlers/main.yml
- name: Restart sshd
  ansible.builtin.service:
    name: "{{ 'sshd' if ansible_facts['os_family'] == 'RedHat' else 'ssh' }}"
    state: restarted`},
{h:'Apply to groups with different variables'},
{code:`# site.yml
- name: Baseline hardening
  hosts: all
  become: true
  roles:
    - hardening

# group_vars/dev.yml
hardening_ssh_password_auth: "yes"
hardening_ssh_max_auth_tries: 6

# group_vars/prod.yml
hardening_packages_present: [fail2ban, auditd]
hardening_banner_text: "Production system. Authorised use only."`},
{h:'Verify'},
{flow:['--syntax-check and --check --diff on one dev host','Apply to dev, open a second SSH session first','Second run reports changed=0','Review the prod diff, then apply with serial 1','Keep a session open until a fresh login works']},
{note:'When changing SSH settings always keep an existing session open and test a new login before closing it. Validation protects against syntax errors, not against a policy that locks you out.'}],
src:[['Roles',R],['sysctl','https://docs.ansible.com/ansible/latest/collections/ansible/posix/sysctl_module.html']]};
})();
