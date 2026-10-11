/* LearnSphere - Ansible, Section 07: Control Flow & Reliability.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG;

/* ---------- diagrams ---------- */
const blockFlow=K.dg(700,200,[
[10,10,680,180,'block, rescue, always',1],
[30,70,150,60,'block:|tasks to attempt',2],[250,35,170,50,'rescue:|runs only on failure',0],[250,115,170,50,'always:|runs every time',0],[500,70,170,60,'Play continues|(rescued or ok)',0]],
[[180,90,250,60],[180,110,250,140],[420,60,500,90],[420,140,500,110]]);

const serialFlow=K.dg(700,220,[
[10,10,680,200,'serial: 2  (hosts per batch)',1],
[30,60,140,50,'Batch 1|web1, web2',2],[200,60,140,50,'Batch 2|web3, web4',0],[370,60,140,50,'Batch 3|web5, web6',0],[540,60,130,50,'Done',0],
[30,140,300,45,'Each batch runs all tasks|before the next batch',0],[370,140,300,45,'Stop when failures|exceed max_fail_percentage',2]],
[[170,85,200,85],[340,85,370,85],[510,85,540,85]]);

const rollFlow=K.dg(700,200,[
[10,10,680,180,'Zero-downtime rolling deploy (per batch)',1],
[25,70,100,60,'Drain from|load balancer',2],[145,70,100,60,'Stop app,|update code',0],[265,70,100,60,'Start app,|wait for port',0],[385,70,100,60,'Health check|HTTP 200',2],[505,70,100,60,'Return to|load balancer',2],[620,70,60,60,'Next|batch',0]],
[[125,100,145,100],[245,100,265,100],[365,100,385,100],[485,100,505,100],[605,100,620,100]]);

/* ---------- 0: when ---------- */
L['ansible:6:0']={blocks:[
{p:'Real hosts differ, and tasks should not all apply to every one. The `when` keyword runs a task only if a condition is true. The condition is a Jinja2 expression **without braces**.'},
{code:`- name: Install Apache on RedHat family
  ansible.builtin.dnf:
    name: httpd
    state: present
  when: ansible_facts['os_family'] == "RedHat"

- name: Install Apache on Debian family
  ansible.builtin.apt:
    name: apache2
    state: present
  when: ansible_facts['os_family'] == "Debian"`},
{h:'Writing conditions'},
{t:[['Need','Example'],
['Equality, comparison','`when: app_port == 8080`, `when: memtotal > 2048`'],
['And / or / not','`when: a and b`, `when: a or b`, `when: not c`'],
['All must be true (list)','`when:` followed by a list of conditions'],
['Variable exists','`when: app_dir is defined`'],
['In a list','`when: "web" in group_names`'],
['Registered result','`when: result is failed`, `when: result.rc == 0`'],
['String as boolean','`when: enable_tls | bool`']]},
{code:`# a list means AND
when:
  - ansible_facts['os_family'] == "Debian"
  - ansible_facts['distribution_major_version'] | int >= 22
  - not ansible_check_mode

# OR needs an explicit expression
when: env == "prod" or force_update | default(false) | bool`},
{h:'Where a condition is evaluated'},
{ul:['**Per host**, so different hosts can take different paths.','**Per item** when combined with a loop. The condition sees the loop variable `item`.','On a **block**, it applies to every task inside the block.','The task shows as **skipped** when the condition is false; a skipped registered task has `skipped: true`.']},
{code:`- name: Remove only the old users
  ansible.builtin.user:
    name: "{{ item.name }}"
    state: absent
  loop: "{{ users }}"
  when: item.retired | default(false)`},
{h:'Common pitfalls'},
{t:[['Mistake','Result','Fix'],
['`when: "{{ var }}"`','Warning, may work by accident','`when: var`'],
['`when: var == true` with the string "true"','False','Use `var | bool`'],
['Variable undefined','Task fails','`is defined` or `default`'],
['Complex logic repeated everywhere','Hard to maintain','Compute once with `set_fact`']]},
{note:'Conditions on facts are a **runtime** decision. If a task is skipped for a reason you did not expect, run with `-v` to see the skip reason, or print the fact you test.'}],
src:[['Conditionals',UG+'playbooks_conditionals.html']]};

/* ---------- 1: Loops ---------- */
L['ansible:6:1']={blocks:[
{p:'A **loop** repeats a task for each item in a list. It keeps playbooks short and makes adding an item a one-line change in data.'},
{code:`- name: Install several packages
  ansible.builtin.package:
    name: "{{ item }}"
    state: present
  loop:
    - git
    - curl
    - tmux`},
{p:'Many modules accept a list directly (`name: [git, curl]`). That is faster because it runs once. Use `loop` when the module takes one item at a time or each item needs different options.'},
{h:'Loop over dictionaries'},
{code:`- name: Create users with different shells
  ansible.builtin.user:
    name: "{{ item.name }}"
    shell: "{{ item.shell | default('/bin/bash') }}"
    groups: "{{ item.groups | default([]) }}"
  loop:
    - { name: alice, shell: /bin/zsh, groups: [developers] }
    - { name: bob }

- name: Loop over a dictionary
  ansible.builtin.debug:
    msg: "{{ item.key }} = {{ item.value }}"
  loop: "{{ settings | dict2items }}"`},
{h:'loop_control'},
{t:[['Option','Purpose'],
['`label`','Short text shown in output instead of the full item'],
['`loop_var`','Rename `item`, essential in nested includes and roles'],
['`index_var`','Name for the current index'],
['`pause`','Seconds to wait between iterations'],
['`extended`','Enable `ansible_loop` data such as `first` and `last`']]},
{code:`- name: Create users, readable output
  ansible.builtin.user:
    name: "{{ user.name }}"
  loop: "{{ users }}"
  loop_control:
    loop_var: user
    label: "{{ user.name }}"`},
{h:'Looping over results'},
{code:`- name: Check several paths
  ansible.builtin.stat:
    path: "{{ item }}"
  loop: [/etc/app, /var/lib/app]
  register: paths

- name: Report the missing ones
  ansible.builtin.debug:
    msg: "{{ item.item }} is missing"
  loop: "{{ paths.results }}"
  when: not item.stat.exists`},
{h:'Old style versus loop'},
{t:[['Legacy','Current'],
['`with_items`','`loop`'],
['`with_dict`','`loop` with `dict2items`'],
['`with_nested`','`loop` with `product` filter'],
['`with_fileglob`','`loop` with `query("fileglob", ...)`'],
['`with_subelements`','`loop` with `subelements` filter']]},
{note:'Loops run **sequentially per host**. A loop of 100 items on 50 hosts is 100 steps. Prefer modules that accept lists, or run the loop at the right level.'}],
src:[['Loops',UG+'playbooks_loops.html']]};

/* ---------- 2: Blocks ---------- */
L['ansible:6:2']={blocks:[
{p:'A **block** groups tasks so they can share keywords and so that failures are handled in one place. With `rescue` and `always` it works like try, catch and finally in a programming language.'},
{svg:blockFlow},
{code:`- name: Upgrade the application with rollback
  hosts: app
  become: true
  tasks:
    - name: Upgrade safely
      block:
        - name: Back up the current release
          ansible.builtin.command: cp -a /opt/app/current /opt/app/previous
          args:
            creates: /opt/app/previous

        - name: Install the new release
          ansible.builtin.unarchive:
            src: "app-{{ app_version }}.tar.gz"
            dest: /opt/app/current

        - name: Run database migrations
          ansible.builtin.command: /opt/app/current/bin/migrate

      rescue:
        - name: Restore the previous release
          ansible.builtin.command: cp -a /opt/app/previous/. /opt/app/current/

        - name: Report the failure
          ansible.builtin.debug:
            msg: "Rolled back {{ inventory_hostname }}: {{ ansible_failed_result.msg | default('see output') }}"

      always:
        - name: Make sure the service is running
          ansible.builtin.service:
            name: app
            state: restarted`},
{h:'What each part does'},
{t:[['Section','Runs when','Notes'],
['`block`','Always attempted','Tasks run in order; the first failure stops the block'],
['`rescue`','A task in the block failed','If it succeeds, the host counts as **rescued** and the play continues'],
['`always`','Always, after block and rescue','Cleanup, restarts, notifications']]},
{h:'Sharing keywords'},
{p:'Keywords on the block apply to every task inside it, which removes repetition.'},
{code:`- block:
    - ansible.builtin.package: { name: nginx, state: present }
    - ansible.builtin.service: { name: nginx, state: started }
  when: ansible_facts['os_family'] == "RedHat"
  become: true
  tags: [web]`},
{h:'Useful variables in rescue'},
{t:[['Variable','Content'],
['`ansible_failed_task`','The task that failed (name and more)'],
['`ansible_failed_result`','The result of that task']]},
{note:'A play recap shows `rescued=1` when a block recovered. It is not an error, but it is a signal worth alerting on: the host was not in the state you intended.'}],
src:[['Blocks',UG+'playbooks_blocks.html'],['Error handling',UG+'playbooks_error_handling.html']]};

/* ---------- 3: Controlling results ---------- */
L['ansible:6:3']={blocks:[
{p:'Ansible decides whether a task changed or failed from the module result. For `command` and `shell`, and for modules that return unusual codes, you must tell it what **changed** and **failed** mean.'},
{h:'The keywords'},
{t:[['Keyword','Purpose','Example'],
['`changed_when`','Define when a task counts as changed','`changed_when: "created" in out.stdout`'],
['`failed_when`','Define when a task counts as failed','`failed_when: rc not in [0, 2]`'],
['`ignore_errors`','Continue even if the task fails','`ignore_errors: true`'],
['`ignore_unreachable`','Continue if the host is unreachable','`ignore_unreachable: true`'],
['`any_errors_fatal`','Stop the whole play when any host fails','`any_errors_fatal: true`']]},
{code:`- name: Run a script that returns 2 for "nothing to do"
  ansible.builtin.command: /opt/app/bin/sync
  register: sync
  failed_when: sync.rc not in [0, 2]
  changed_when: sync.rc == 0

- name: Read-only check, never changed
  ansible.builtin.command: grep -c ERROR /var/log/app.log
  register: errors
  changed_when: false
  failed_when: errors.rc > 1       # grep returns 1 when no match`},
{h:'Assert and fail'},
{code:`- name: Stop early with a clear message
  ansible.builtin.assert:
    that:
      - app_version is defined
      - app_version is match("^[0-9]+[.][0-9]+")
    fail_msg: "Set app_version, for example 1.4"

- name: Refuse to run on production by mistake
  ansible.builtin.fail:
    msg: "This playbook is not allowed on production"
  when: env == "prod"`},
{h:'When to use which'},
{flow:['Command exit code has a special meaning: use failed_when','Command only reads data: use changed_when false','A single known failure is harmless: ignore_errors, with a comment','A bad state must stop everything: any_errors_fatal or assert']},
{h:'Use ignore_errors with care'},
{ul:['It hides real problems. Prefer `failed_when` with an exact condition.','A task that ignores errors still shows `...ignoring` in the output; review those lines.','Never use it on tasks whose result later tasks assume.']},
{note:'`assert` at the top of a play is excellent documentation of what the play expects. It fails early, before any change has been made.'}],
src:[['Error handling',UG+'playbooks_error_handling.html'],['assert',D+'collections/ansible/builtin/assert_module.html']]};

/* ---------- 4: Retries and waiting ---------- */
L['ansible:6:4']={blocks:[
{p:'Services take time to start, clusters take time to converge, and cloud APIs are eventually consistent. Fixed sleeps are either too short or wasteful. Ansible gives you two better tools: **until/retries** and **wait_for**.'},
{h:'Retry until a condition is true'},
{code:`- name: Wait for the application to become healthy
  ansible.builtin.uri:
    url: http://localhost:8080/health
    return_content: true
  register: health
  until: health.status == 200 and "ok" in health.content
  retries: 12
  delay: 5          # up to 12 x 5 = 60 seconds`},
{t:[['Keyword','Meaning','Default'],
['`until`','Condition that ends the loop','none'],
['`retries`','Maximum attempts','3'],
['`delay`','Seconds between attempts','5']]},
{h:'wait_for'},
{code:`- name: Wait for the port to accept connections
  ansible.builtin.wait_for:
    port: 5432
    host: 127.0.0.1
    delay: 2
    timeout: 60

- name: Wait for a file to appear
  ansible.builtin.wait_for:
    path: /var/run/app.pid
    state: present

- name: Wait for a log line
  ansible.builtin.wait_for:
    path: /var/log/app.log
    search_regex: "Started in [0-9]+ ms"
    timeout: 120`},
{h:'After a reboot'},
{code:`- name: Reboot and wait
  ansible.builtin.reboot:
    reboot_timeout: 600

# or, when something else rebooted the host
- name: Wait until the host answers again
  ansible.builtin.wait_for_connection:
    delay: 10
    timeout: 300`},
{h:'Choosing'},
{t:[['Situation','Tool'],
['Port, file or log text to appear','`wait_for`'],
['HTTP endpoint or API result','`uri` with `until`'],
['Host has rebooted','`reboot` or `wait_for_connection`'],
['A command result must change','`command` with `until`'],
['Human approval','`pause` (interactive runs only)']]},
{note:'Always set a timeout. An infinite wait inside automation stalls pipelines and ties up runners.'}],
src:[['Retrying a task until a condition is met',UG+'playbooks_loops.html#retrying-a-task-until-a-condition-is-met'],['wait_for',D+'collections/ansible/builtin/wait_for_module.html']]};

/* ---------- 5: Delegation ---------- */
L['ansible:6:5']={blocks:[
{p:'Sometimes a task is about host A but must run somewhere else: remove a server from a load balancer, add a DNS record, call an API from the control node. **Delegation** runs the task on another machine while keeping the context of the original host.'},
{code:`- name: Remove this host from the load balancer
  ansible.builtin.command: >
    /usr/local/bin/lb-ctl disable {{ inventory_hostname }}
  delegate_to: lb1

- name: Call an API from the control node
  ansible.builtin.uri:
    url: "https://cmdb.example.com/api/hosts/{{ inventory_hostname }}"
    method: PUT
    body_format: json
    body: { status: "maintenance" }
  delegate_to: localhost`},
{h:'What stays the same'},
{ul:['`inventory_hostname` is still the **original** host, so variables resolve as for that host.','Connection and become settings are taken from the **delegated** host.','Facts gathered by a delegated task belong to the original host unless `delegate_facts: true`.']},
{h:'run_once'},
{p:'`run_once: true` runs a task on the **first host** of the current batch only. Typical uses: a database migration, a one-time notification, creating a shared resource.'},
{code:`- name: Run database migrations once per play
  ansible.builtin.command: /opt/app/bin/migrate
  run_once: true

- name: Apply the same on a specific host once
  ansible.builtin.command: /opt/app/bin/seed
  run_once: true
  delegate_to: "{{ groups['db'][0] }}"`},
{h:'run_once with serial'},
{p:'With `serial`, `run_once` runs once **per batch**, not once per play. If you need once in the whole play, add a condition such as `when: inventory_hostname == ansible_play_hosts_all[0]`.'},
{h:'Common delegation targets'},
{t:[['Target','Why'],
['`localhost`','Call HTTP APIs, run local tools, write local files'],
['Load balancer host','Drain and enable members'],
['Monitoring server','Create downtime or silence alerts'],
['Database primary','Run schema changes once']]},
{note:'`local_action` is the older spelling of `delegate_to: localhost`. Prefer `delegate_to`; it is more explicit and works with all modules.'}],
src:[['Controlling where tasks run: delegation and local actions',UG+'playbooks_delegation.html']]};

/* ---------- 6: Rolling updates ---------- */
L['ansible:6:6']={blocks:[
{p:'By default a play runs each task on **all hosts** before moving on. For updates this is dangerous: if the change is wrong, every server is broken at the same time. **serial** processes hosts in batches so a bad change stops early.'},
{svg:serialFlow},
{h:'serial'},
{code:`- name: Rolling update
  hosts: web
  serial:
    - 1          # first a single canary host
    - 25%        # then a quarter of the remaining hosts
    - 100%       # then everything left
  max_fail_percentage: 20
  tasks:
    - name: Update the application
      ansible.builtin.include_role:
        name: app_release`},
{t:[['Form','Meaning'],
['`serial: 2`','Two hosts per batch'],
['`serial: "30%"`','Thirty percent of hosts per batch'],
['`serial: [1, 5, 10]`','Growing batches; the last value repeats']]},
{h:'Stopping when it goes wrong'},
{t:[['Keyword','Behaviour'],
['`max_fail_percentage: 0`','Stop the play on the first failure in a batch'],
['`max_fail_percentage: 25`','Abort when failures exceed 25% of the batch'],
['`any_errors_fatal: true`','Any failure aborts the play for all hosts'],
['(default)','Failed hosts are dropped; others carry on']]},
{h:'Strategies'},
{t:[['Strategy','Behaviour','Use'],
['`linear` (default)','Each task completes on all hosts in a batch before the next task','Predictable, most playbooks'],
['`free`','Each host runs ahead independently','Independent tasks, slow hosts'],
['`host_pinned`','Like free, but hosts stay on their worker','Reduce handoff overhead'],
['`debug`','Interactive debugger on failure','Troubleshooting']]},
{h:'Other throttles'},
{ul:['`forks` limits connection parallelism for the whole run.','`throttle: 2` on a task limits how many hosts run that **one task** at once, for example a heavy package install.','`order: sorted` or `reverse_sorted` controls host order within a play.']},
{flow:['Start with a canary batch of one host','Verify health on the canary','Expand batches while failures stay below the limit','Abort and keep the rest on the old version if the limit is exceeded']},
{note:'`serial` is a play-level setting. All tasks of the play run per batch, including handlers, which is exactly what you want for restarts.'}],
src:[['Setting the batch size with serial',UG+'playbooks_strategies.html#setting-the-batch-size-with-serial'],['Strategies',UG+'playbooks_strategies.html']]};

/* ---------- 7: Practical rolling deploy ---------- */
L['ansible:6:7']={blocks:[
{p:'This practical ties the section together: a **zero-downtime rolling deploy** that takes each web server out of the load balancer, updates it, checks it and puts it back, one batch at a time, aborting if anything goes wrong.'},
{svg:rollFlow},
{h:'Assumptions'},
{ul:['Hosts in group `web` sit behind one load balancer `lb1`.','The load balancer has a small control command or API that enables and disables members.','The application exposes `/health` that returns HTTP 200 when ready.']},
{h:'The playbook'},
{code:`- name: Rolling deploy
  hosts: web
  become: true
  serial:
    - 1
    - "50%"
  max_fail_percentage: 0
  vars:
    app_version: "{{ release | mandatory }}"

  pre_tasks:
    - name: Take this host out of the load balancer
      ansible.builtin.command: "lb-ctl disable {{ inventory_hostname }}"
      delegate_to: lb1
      changed_when: true

    - name: Wait for in-flight requests to drain
      ansible.builtin.pause:
        seconds: 15

  tasks:
    - name: Update the application
      block:
        - name: Stop the application
          ansible.builtin.service:
            name: app
            state: stopped

        - name: Unpack the release
          ansible.builtin.unarchive:
            src: "releases/app-{{ app_version }}.tar.gz"
            dest: /opt/app/current

        - name: Start the application
          ansible.builtin.service:
            name: app
            state: started

        - name: Wait for the port
          ansible.builtin.wait_for:
            port: 8080
            timeout: 60

        - name: Check health
          ansible.builtin.uri:
            url: http://localhost:8080/health
            status_code: 200
          register: health
          until: health.status == 200
          retries: 10
          delay: 3

      rescue:
        - name: Leave this host out of rotation and stop the rollout
          ansible.builtin.fail:
            msg: "Deploy failed on {{ inventory_hostname }}; host left disabled"

  post_tasks:
    - name: Return this host to the load balancer
      ansible.builtin.command: "lb-ctl enable {{ inventory_hostname }}"
      delegate_to: lb1
      changed_when: true`},
{h:'Why it is safe'},
{t:[['Mechanism','Protection'],
['`serial: [1, "50%"]`','One canary host first, then half'],
['`max_fail_percentage: 0`','The first failure stops the rollout'],
['Drain before change','Users are not sent to a host being updated'],
['Health check with `until`','Only healthy hosts re-enter the pool'],
['`rescue` and `fail`','A failed host stays out of rotation instead of serving errors'],
['`mandatory` release variable','A missing version stops the run before anything changes']]},
{h:'Run it'},
{code:`ansible-playbook rollout.yml -e release=1.5.0 --check --diff --limit web01
ansible-playbook rollout.yml -e release=1.5.0`},
{note:'Practise by deliberately breaking the health endpoint on one host. Confirm the rollout stops, that the host remains out of the pool and that untouched hosts keep serving the old version.'}],
src:[['Rolling updates',UG+'guide_rolling_upgrade.html'],['Strategies',UG+'playbooks_strategies.html']]};
})();
