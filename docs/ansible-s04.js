/* LearnSphere - Ansible, Section 04: Ad-Hoc Commands & Core Modules.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,B=D+'collections/ansible/builtin/';

/* ---------- diagrams ---------- */
const anatomy=K.dg(700,170,[
[10,10,680,150,'Anatomy of an ad-hoc command',1],
[25,60,100,50,'ansible',0],[145,60,110,50,'pattern|web:&prod',2],[275,60,130,50,'-m module|ansible.builtin.dnf',2],[425,60,130,50,'-a arguments|"name=nginx"',2],[575,60,100,50,'options|-b -u -i',0]],
[[125,85,145,85],[255,85,275,85],[405,85,425,85],[555,85,575,85]]);

const becomeFlow=K.dg(700,170,[
[10,10,680,150,'Privilege escalation',1],
[30,60,150,60,'SSH login as|ansible (normal user)',0],[250,60,180,60,'become: sudo|become_user: root',2],[500,60,170,60,'Task runs|with root rights',2]],
[[180,90,250,90],[430,90,500,90]]);

/* ---------- 0: Ad-hoc anatomy ---------- */
L['ansible:3:0']={blocks:[
{p:'An **ad-hoc command** runs a single module against hosts straight from the command line, with no playbook. It is ideal for quick checks and one-off actions, and it is the best way to explore modules.'},
{svg:anatomy},
{h:'The general form'},
{code:`ansible <pattern> -m <module> -a "<arguments>" [options]

ansible web -m ansible.builtin.ping
ansible web -m ansible.builtin.command -a "uptime"
ansible db  -b -m ansible.builtin.dnf -a "name=postgresql-server state=present"`},
{h:'Common options'},
{t:[['Option','Meaning'],
['`-i`','Inventory file, directory or plugin'],
['`-m`','Module name (use the FQCN)'],
['`-a`','Arguments as `key=value` pairs or JSON'],
['`-b`','Become (privilege escalation), default sudo to root'],
['`-u`','Remote user'],
['`-K`','Ask for the become password'],
['`-f`','Forks: number of hosts in parallel'],
['`-o`','One-line output per host'],
['`--check`, `--diff`','Preview changes (lecture 7)'],
['`-e`','Extra variables']]},
{h:'When ad-hoc is the right tool'},
{t:[['Good use','Better as a playbook'],
['Check disk space or uptime on many hosts','Anything you will do more than twice'],
['Restart one service during an incident','Multi-step changes'],
['Copy one file','Anything that must be reviewed and kept'],
['Gather facts to inspect','Changes that need variables, loops or handlers']]},
{h:'Examples'},
{code:`# disk usage everywhere
ansible all -m ansible.builtin.command -a "df -h /"

# restart a service on web hosts
ansible web -b -m ansible.builtin.service -a "name=nginx state=restarted"

# copy a file
ansible web -b -m ansible.builtin.copy -a "src=motd dest=/etc/motd mode=0644"

# run five hosts at a time
ansible all -f 5 -m ansible.builtin.ping`},
{h:'Find out how a module works'},
{code:`ansible-doc ansible.builtin.copy         # full documentation
ansible-doc -s ansible.builtin.copy      # short snippet of options
ansible-doc -l | grep -i user            # search for modules`},
{note:'If you omit `-m`, Ansible uses `ansible.builtin.command`. So `ansible web -a "uptime"` works, but being explicit makes commands easier to read and review.'}],
src:[['Introduction to ad-hoc commands',UG+'intro_adhoc.html'],['ansible CLI',K.CLI+'ansible.html']]};

/* ---------- 1: Files and content ---------- */
L['ansible:3:1']={blocks:[
{p:'Files are the most common thing automation touches. Five modules cover almost every case, and each is idempotent: it only changes the file if it differs from what you asked for.'},
{h:'Which module for which job'},
{t:[['Module','Use it to','Key options'],
['**file**','Set permissions, ownership, create or delete files, folders and links','`path`, `state`, `owner`, `group`, `mode`'],
['**copy**','Send a whole file or literal content from the control node','`src`, `dest`, `content`, `backup`, `validate`'],
['**fetch**','Pull a file from the managed node to the control node','`src`, `dest`, `flat`'],
['**lineinfile**','Ensure one line exists (or is removed) in a file','`path`, `regexp`, `line`, `state`'],
['**blockinfile**','Ensure a multi-line block exists between markers','`path`, `block`, `marker`']]},
{h:'file'},
{code:`- name: Create a directory with owner and mode
  ansible.builtin.file:
    path: /opt/app
    state: directory
    owner: app
    group: app
    mode: "0750"

- name: Remove a file
  ansible.builtin.file:
    path: /tmp/old.log
    state: absent`},
{t:[['state','Result'],
['`file`','Must exist; only attributes are changed (default)'],
['`directory`','Create the directory (and parents)'],
['`touch`','Create or update timestamp'],
['`absent`','Delete file or folder'],
['`link` / `hard`','Symbolic or hard link']]},
{p:'Always quote `mode` values such as `"0644"`. Unquoted, YAML may read them as a different number.'},
{h:'copy'},
{code:`- name: Install a configuration file
  ansible.builtin.copy:
    src: files/app.conf
    dest: /etc/app/app.conf
    owner: root
    group: root
    mode: "0644"
    backup: true          # keep a timestamped copy if it changes

- name: Write short content directly
  ansible.builtin.copy:
    content: "Managed by Ansible\\n"
    dest: /etc/motd`},
{h:'lineinfile and blockinfile'},
{code:`- name: Make sure SSH root login is disabled
  ansible.builtin.lineinfile:
    path: /etc/ssh/sshd_config
    regexp: "^#?PermitRootLogin"
    line: "PermitRootLogin no"
    validate: "sshd -t -f %s"

- name: Add a block of hosts entries
  ansible.builtin.blockinfile:
    path: /etc/hosts
    marker: "# {mark} ANSIBLE MANAGED: lab hosts"
    block: |
      192.168.56.11 node1
      192.168.56.12 node2`},
{h:'fetch'},
{code:`- name: Collect a report from each host
  ansible.builtin.fetch:
    src: /var/log/app/report.txt
    dest: "reports/{{ inventory_hostname }}.txt"
    flat: true`},
{h:'Choosing well'},
{ul:['**Whole file under your control:** use `copy` or `template` (Section 6). It is the clearest and safest.','**One setting in a vendor file:** `lineinfile` with a precise `regexp`.','**A section of a file:** `blockinfile`.','If you manage most of a file, stop editing lines and template the whole file.']},
{note:'Use `validate` for files that can break a service when wrong, such as sshd or sudoers. The change is only applied if the check command succeeds.'}],
src:[['file',B+'file_module.html'],['copy',B+'copy_module.html'],['lineinfile',B+'lineinfile_module.html'],['blockinfile',B+'blockinfile_module.html']]};

/* ---------- 2: Packages and services ---------- */
L['ansible:3:2']={blocks:[
{p:'Installing software and managing services are the daily bread of configuration management. Ansible offers portable modules and OS-specific ones; knowing which to use keeps playbooks short and correct.'},
{h:'Package modules'},
{t:[['Module','Works on','Notes'],
['`ansible.builtin.package`','Any OS with a supported manager','Generic; package **names** may still differ per OS'],
['`ansible.builtin.dnf`','RHEL, Fedora, Rocky, Alma','Modern; replaces yum'],
['`ansible.builtin.apt`','Debian, Ubuntu','Supports `update_cache`, `cache_valid_time`'],
['`ansible.builtin.yum`','Older RHEL family','Alias to dnf on new systems'],
['`ansible.builtin.pip`','Python packages','Use a virtual environment'],
['`ansible.builtin.package_facts`','All','Gather installed packages as facts']]},
{h:'state values'},
{t:[['state','Meaning'],
['`present`','Installed; any version (default)'],
['`latest`','Install and upgrade to the newest available'],
['`absent`','Removed']]},
{code:`- name: Install packages (portable)
  ansible.builtin.package:
    name:
      - nginx
      - curl
    state: present

- name: Debian family, refresh the cache at most once an hour
  ansible.builtin.apt:
    name: nginx
    state: present
    update_cache: true
    cache_valid_time: 3600
  when: ansible_facts['os_family'] == "Debian"`},
{h:'Handling different package names'},
{p:'Apache is `httpd` on RHEL and `apache2` on Debian. Map the difference in variables, not in the task logic.'},
{code:`vars:
  web_package:
    RedHat: httpd
    Debian: apache2

tasks:
  - name: Install the web server
    ansible.builtin.package:
      name: "{{ web_package[ansible_facts['os_family']] }}"
      state: present`},
{h:'Service modules'},
{t:[['Module','Use'],
['`ansible.builtin.service`','Generic start, stop, restart, enable across init systems'],
['`ansible.builtin.systemd_service`','systemd specific: `daemon_reload`, `masked`, scopes']]},
{code:`- name: Make sure nginx runs now and at boot
  ansible.builtin.service:
    name: nginx
    state: started
    enabled: true

- name: Reload unit files after adding a service
  ansible.builtin.systemd_service:
    daemon_reload: true`},
{t:[['state','Meaning','Reported changed when'],
['`started`','Running','It was stopped'],
['`stopped`','Not running','It was running'],
['`restarted`','Stop then start','Always'],
['`reloaded`','Reload configuration','Always']]},
{note:'`restarted` and `reloaded` always report changed. In real playbooks put them in a **handler** (Section 5) so they run only when a configuration file actually changed.'}],
src:[['package',B+'package_module.html'],['apt',B+'apt_module.html'],['dnf',B+'dnf_module.html'],['systemd_service',B+'systemd_service_module.html']]};

/* ---------- 3: Users, groups, keys ---------- */
L['ansible:3:3']={blocks:[
{p:'Accounts and SSH keys are a core part of server setup and offboarding. The modules are simple, but passwords and keys need some care.'},
{h:'group and user'},
{code:`- name: Create a group
  ansible.builtin.group:
    name: developers
    state: present

- name: Create a user
  ansible.builtin.user:
    name: alice
    comment: "Alice Example"
    groups: developers,wheel
    append: true              # add to groups without removing existing ones
    shell: /bin/bash
    create_home: true
    state: present`},
{t:[['Option','Why it matters'],
['`groups` + `append: true`','Without append, the user is removed from every group not listed'],
['`state: absent` + `remove: true`','Delete the account and its home directory'],
['`password`','Must be a **hash**, never plain text'],
['`update_password: on_create`','Set the password only at creation, never reset it later'],
['`generate_ssh_key: true`','Create a key pair for the user']]},
{h:'Passwords'},
{p:'The `password` field wants a crypted hash. Create it with the `password_hash` filter, or better, keep the hash in an encrypted vault file.'},
{code:`- name: Create a user with a password hash
  ansible.builtin.user:
    name: bob
    password: "{{ 'S3cret!' | password_hash('sha512', 'fixedsalt') }}"
    update_password: on_create`},
{p:'Give the filter a fixed salt. Without one, a new random salt is created each run, which makes the module report **changed** every time and breaks idempotency.'},
{h:'SSH keys'},
{code:`- name: Install a public key for alice
  ansible.posix.authorized_key:
    user: alice
    state: present
    key: "{{ lookup('ansible.builtin.file', 'files/keys/alice.pub') }}"

- name: Make this the only authorized key (revoke the rest)
  ansible.posix.authorized_key:
    user: deploy
    key: "{{ lookup('ansible.builtin.file', 'files/keys/deploy.pub') }}"
    exclusive: true`},
{p:'`authorized_key` lives in the **ansible.posix** collection, so install it first (Section 9) or use the community package.'},
{h:'Offboarding flow'},
{flow:['Remove user from inventory data or variable list','Run the user task with state absent and remove true','Run authorized_key with exclusive on shared accounts','Rotate shared secrets','Record the change in Git']},
{note:'Treat user lists as data (a variable list in group_vars) and loop over them. Adding or removing a person becomes a one-line pull request.'}],
src:[['user',B+'user_module.html'],['group',B+'group_module.html'],['authorized_key','https://docs.ansible.com/ansible/latest/collections/ansible/posix/authorized_key_module.html']]};

/* ---------- 4: Command modules ---------- */
L['ansible:3:4']={blocks:[
{p:'Four modules run arbitrary commands. They are powerful and are also the main source of non-idempotent, hard-to-test automation, so learn their differences and use them last.'},
{t:[['Module','Runs through','Shell features (pipes, redirects, variables)','Needs Python on target','Use for'],
['**command**','Direct exec, no shell','No','Yes','Most one-off commands (default)'],
['**shell**','`/bin/sh`','Yes','Yes','When you truly need a pipe or redirect'],
['**raw**','SSH directly','Yes','**No**','Bootstrap: installing Python, network gear'],
['**script**','Copies a local script and runs it','Script decides','Yes','Running an existing local script on targets']]},
{h:'command versus shell'},
{code:`# command: no pipes, safer
- name: Show the kernel
  ansible.builtin.command: uname -r

# shell: needed for the pipe
- name: Count running processes
  ansible.builtin.shell: ps aux | wc -l
  changed_when: false`},
{p:'Prefer `command`. A shell parses its input, so unquoted variables can cause surprises and injection problems. When you must interpolate, use `{{ value | quote }}`.'},
{h:'Restoring idempotency'},
{p:'These modules cannot see state, so tell them when to skip.'},
{code:`- name: Initialise the database only once
  ansible.builtin.command: /opt/app/bin/init-db
  args:
    creates: /var/lib/app/.initialised     # skip if this path exists

- name: Remove the old cache
  ansible.builtin.command: /opt/app/bin/purge
  args:
    removes: /var/cache/app/old            # skip if this path does not exist`},
{h:'raw for bootstrapping'},
{code:`- name: Install Python on a minimal host
  ansible.builtin.raw: test -e /usr/bin/python3 || (apt-get update && apt-get install -y python3)
  changed_when: false`},
{h:'Decision guide'},
{flow:['Is there a module for the job?','Yes: use it','No: command with creates, removes or changed_when','Need a pipe or redirect: shell, with quoting','No Python on the target: raw']},
{note:'A `shell` task with `changed_when: false` and `check_mode: false` is acceptable for read-only queries. For anything that modifies, search for a module first.'}],
src:[['command',B+'command_module.html'],['shell',B+'shell_module.html'],['raw',B+'raw_module.html'],['script',B+'script_module.html']]};

/* ---------- 5: become ---------- */
L['ansible:3:5']={blocks:[
{p:'You log in as an ordinary user and escalate only for tasks that need it. This is **privilege escalation**, called **become** in Ansible. It maps to sudo by default.'},
{svg:becomeFlow},
{h:'Where you can set it'},
{t:[['Where','Example','Scope'],
['Command line','`-b`, `--become-user`, `-K`','One run'],
['Play','`become: true`','All tasks in the play'],
['Task or block','`become: true` / `become_user: app`','That task or block'],
['Inventory variable','`ansible_become=true`','Per host or group'],
['ansible.cfg','`[privilege_escalation] become = True`','Default for everything']]},
{h:'Keywords'},
{t:[['Keyword','Meaning','Default'],
['`become`','Turn escalation on','false'],
['`become_user`','Target user','root'],
['`become_method`','`sudo`, `su`, `doas`, `runas`, `pbrun`, ...','sudo'],
['`become_flags`','Extra flags passed to the method','none'],
['`become_password`','Password (use vault or `-K`, never plain text)','none']]},
{code:`- name: Mixed privileges in one play
  hosts: web
  tasks:
    - name: Install nginx (needs root)
      ansible.builtin.package:
        name: nginx
        state: present
      become: true

    - name: Deploy app code as the app user
      ansible.builtin.git:
        repo: https://example.com/app.git
        dest: /opt/app
      become: true
      become_user: app`},
{h:'Common problems'},
{t:[['Symptom','Cause','Fix'],
['`Missing sudo password`','sudo asks for a password','Use NOPASSWD for the automation user or `-K`'],
['`Failed to set permissions on the temporary files`','Becoming an unprivileged user','Enable pipelining or install ACL support'],
['Changes appear as root when they should not','become set too widely','Set it at task level only where needed'],
['Task works as root but not as user','Wrong file ownership','Use `become_user` for the owner']]},
{note:'Apply the **least privilege** rule: do not set `become: true` on a whole play when only two tasks need it. A mistaken task as root can do far more damage.'}],
src:[['Understanding privilege escalation',UG+'become.html']]};

/* ---------- 6: Facts ---------- */
L['ansible:3:6']={blocks:[
{p:'**Facts** are information Ansible discovers about each managed node: operating system, network, hardware, mounts, and more. Playbooks use them to adapt behaviour, for example choosing a package manager.'},
{h:'How facts are gathered'},
{flow:['A play starts','Ansible runs the setup module on each host','Results are stored as ansible_facts for the run','Tasks and templates read the values','The next play can gather again or reuse']},
{code:`ansible node1 -m ansible.builtin.setup | head -30
ansible node1 -m ansible.builtin.setup -a "filter=ansible_distribution*"
ansible node1 -m ansible.builtin.setup -a "gather_subset=network,!hardware"`},
{h:'Frequently used facts'},
{t:[['Fact','Example value','Typical use'],
['`ansible_facts["os_family"]`','Debian, RedHat','Choose a package or path'],
['`ansible_facts["distribution"]`','Ubuntu, Rocky','Distribution-specific steps'],
['`ansible_facts["distribution_major_version"]`','24, 9','Version conditions'],
['`ansible_facts["hostname"]`','node1','Names in templates'],
['`ansible_facts["default_ipv4"]["address"]`','192.168.56.11','Bind addresses'],
['`ansible_facts["memtotal_mb"]`','3912','Sizing database memory'],
['`ansible_facts["processor_vcpus"]`','4','Worker counts'],
['`ansible_facts["mounts"]`','list','Check disk space']]},
{code:`- name: Use facts to decide
  ansible.builtin.debug:
    msg: "{{ inventory_hostname }} is {{ ansible_facts['distribution'] }} {{ ansible_facts['distribution_version'] }} with {{ ansible_facts['memtotal_mb'] }} MB RAM"

- name: Only on RedHat family
  ansible.builtin.dnf:
    name: firewalld
    state: present
  when: ansible_facts['os_family'] == "RedHat"`},
{h:'Two ways to write a fact'},
{t:[['Style','Example','Note'],
['Dictionary (recommended)','`ansible_facts["os_family"]`','Always available'],
['Injected variable','`ansible_os_family`','Works by default, but can be disabled with `inject_facts_as_vars = false`']]},
{h:'Control fact gathering'},
{code:`- hosts: web
  gather_facts: false      # skip when you do not use facts (faster)

# gather only a subset
- hosts: web
  gather_subset:
    - "!all"
    - "!min"
    - network`},
{note:'If a play does not use any fact, set `gather_facts: false`. On large inventories this removes seconds per host and gives a measurable speed-up. Caching of facts is in Section 6.'}],
src:[['Discovering variables: facts',UG+'playbooks_vars_facts.html'],['setup',B+'setup_module.html']]};

/* ---------- 7: Check mode and diff ---------- */
L['ansible:3:7']={blocks:[
{p:'Before changing real systems, preview what Ansible would do. **Check mode** simulates a run and reports what would change. **Diff mode** shows exactly how files would change. Together they are your dry run.'},
{h:'The two switches'},
{t:[['Option','Short','Effect'],
['`--check`','`-C`','Do not make changes; report what would change'],
['`--diff`','`-D`','Show before and after for files and templates'],
['`--check --diff`','`-CD`','Both together (most useful)']]},
{code:`ansible-playbook site.yml --check --diff --limit web01

TASK [Install sshd config] ****
--- before: /etc/ssh/sshd_config
+++ after: /etc/ssh/sshd_config
@@ -32,1 +32,1 @@
-PermitRootLogin yes
+PermitRootLogin no
changed: [web01]`},
{h:'How it works'},
{flow:['Each module is asked: would you change anything?','Modules that support check mode compare state and report','Modules without support are skipped','The recap shows changed counts as predictions']},
{h:'Limits to know'},
{ul:['**command, shell, raw and script** are skipped in check mode unless you force them.','A later task that depends on an earlier one (for example a service that needs a package) may report a misleading result, because the earlier change did not happen.','Check mode predicts, it does not guarantee. Always review on staging first.']},
{h:'Per-task control'},
{code:`- name: Read-only query that is safe in check mode
  ansible.builtin.command: cat /etc/app/version
  register: version
  changed_when: false
  check_mode: false        # always run, even in check mode

- name: Risky task, skip in check mode
  ansible.builtin.command: /opt/app/reindex
  when: not ansible_check_mode

- name: Show diff for this task only
  ansible.builtin.template:
    src: app.conf.j2
    dest: /etc/app/app.conf
  diff: true`},
{t:[['Keyword or variable','Purpose'],
['`check_mode: true` / `false`','Force check or real mode for a task'],
['`diff: true` / `false`','Enable or suppress diff for a task'],
['`ansible_check_mode`','Boolean true when the run is in check mode']]},
{note:'Diffs of files containing secrets can print them. Use `diff: false` or `no_log: true` on such tasks (Section 10).'}],
src:[['Validating tasks: check mode and diff mode',UG+'playbooks_checkmode.html']]};
})();
