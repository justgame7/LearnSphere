/* LearnSphere - Ansible, Section 14: Troubleshooting, Best Practices & Exam Preparation.
   Lectures 0-5 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG;

/* ---------- diagrams ---------- */
const dbgFlow=K.dg(700,170,[
[10,10,680,150,'A systematic debugging loop',1],
[25,60,110,50,'Read the|first error',2],[165,60,110,50,'Reproduce on|one host',0],[305,60,110,50,'Raise verbosity|-vvv',0],[445,60,110,50,'Fix one|thing',2],[585,60,90,50,'Run again',0]],
[[135,85,165,85],[275,85,305,85],[415,85,445,85],[555,85,585,85]]);

const capstone=K.dg(700,260,[
[10,10,680,240,'Capstone platform',1],
[250,40,200,50,'Load balancer|nginx',2],
[100,130,180,50,'App server 1',0],[420,130,180,50,'App server 2',0],
[250,200,200,40,'Database (PostgreSQL)',2],
[30,60,140,40,'Monitoring|node_exporter',0],[530,60,140,40,'Backups|nightly',0]],
[[350,90,190,130],[350,90,510,130],[190,180,330,200],[510,180,370,200]]);

/* ---------- 0: Debugging ---------- */
L['ansible:13:0']={blocks:[
{p:'Failures are normal. The skill is finding the cause quickly and fixing exactly that. Ansible gives you verbosity levels, a `debug` module and an interactive debugger.'},
{svg:dbgFlow},
{h:'Verbosity'},
{t:[['Flag','Shows','Use when'],
['(none)','Task names and status','Normal runs'],
['`-v`','Task results (return values)','You need module output'],
['`-vv`','Plus input arguments and file paths','Wrong arguments or config file in use'],
['`-vvv`','Plus connection details, the SSH command','Connection or become problems'],
['`-vvvv`','Plus plugin and connection debugging','Rare, deep SSH problems'],
['`-vvvvv`','Maximum detail','Almost never']]},
{h:'The debug module'},
{code:`- name: Show a variable
  ansible.builtin.debug:
    var: app_version

- name: Show a message with data
  ansible.builtin.debug:
    msg: "Host {{ inventory_hostname }} has {{ ansible_facts['memtotal_mb'] }} MB"

- name: Only print at -vv or higher
  ansible.builtin.debug:
    var: result
    verbosity: 2`},
{h:'The playbook debugger'},
{code:`- name: Task that may fail
  ansible.builtin.command: /opt/app/bin/check
  debugger: on_failed        # also: always, never, on_unreachable, on_skipped

# at the prompt:
# p task          show the task
# p task.args     show its arguments
# task.args['x']='y'   change an argument
# r               redo the task
# c               continue
# q               quit`},
{h:'Extra tools'},
{t:[['Tool','Purpose'],
['`--step`','Confirm each task interactively'],
['`--start-at-task`','Resume from a named task'],
['`ANSIBLE_KEEP_REMOTE_FILES=1`','Keep the generated module files on the host to inspect'],
['`ansible-playbook --check --diff`','See intended changes'],
['`ansible -m setup`','Inspect facts available to a host'],
['`ansible-inventory --host`','Inspect variables']]},
{h:'Method'},
{ul:['Read the **first** error, not the last. Later errors are often consequences.','Reproduce on **one host** with `--limit` and `-vvv`.','Change **one thing** at a time and run again.','If a variable is wrong, print it and check precedence.','If a module behaves oddly, run it ad-hoc with the same arguments.']},
{note:'Remove temporary `debug` tasks before committing, or keep them guarded with `verbosity:`. Debug output can contain secrets.'}],
src:[['Debugging tasks',UG+'playbooks_debugger.html'],['Troubleshooting',D+'reference_appendices/faq.html']]};

/* ---------- 1: Common failures ---------- */
L['ansible:13:1']={blocks:[
{p:'Most problems in daily work fall into a small number of categories. Recognising the message tells you where to look.'},
{h:'Connection and authentication'},
{t:[['Message','Cause','Fix'],
['`UNREACHABLE! ... Connection timed out`','Wrong address, firewall, sshd down','Test `ssh` manually; check `ansible_host` and port'],
['`Permission denied (publickey)`','Wrong user or key','Check `remote_user`, `private_key_file`, `authorized_keys`'],
['`Host key verification failed`','Unknown or changed key','Accept the key deliberately; investigate if it changed'],
['`Too many authentication failures`','ssh-agent offers many keys','`IdentitiesOnly=yes` in ssh args'],
['`Shared connection to host closed`','Interrupted session, command crash','Check the remote command, timeouts, network']]},
{h:'Python and modules'},
{t:[['Message','Cause','Fix'],
['`/usr/bin/python: not found`','No interpreter at that path','Install Python 3 or set `ansible_python_interpreter`'],
['`Interpreter discovery warning`','Ansible guessed the interpreter','Set `interpreter_python = auto_silent` or a path'],
['`could not resolve module/action`','Module not found, collection missing','Install the collection; use the correct FQCN'],
['`No module named ...`','Python library missing on the control node or target','Install it where the module runs'],
['`Failed to import the required Python library`','Module needs a library on the target','Install the package on the managed node']]},
{h:'Privilege escalation'},
{t:[['Message','Cause','Fix'],
['`Missing sudo password`','sudo asks for a password','NOPASSWD rule or `-K`'],
['`sudo: a terminal is required`','`requiretty` set in sudoers','Remove `requiretty` or adjust settings'],
['`Failed to set permissions on the temporary files`','Becoming a non-root user','Enable pipelining or install ACLs']]},
{h:'Data and syntax'},
{t:[['Message','Cause','Fix'],
['`mapping values are not allowed here`','Missing space or unquoted colon','Quote the value, check indentation'],
['`The task includes an option with an undefined variable`','Variable not defined for the host','`default`, define it, check scope'],
['`Unexpected templating type error`','Wrong type in Jinja2','Convert with `int`, `string`, `list`'],
['`Invalid data passed to loop`','Loop value is not a list','Use `| list`, `dict2items`, check variable']]},
{h:'Encoding'},
{p:'Errors such as `UnicodeEncodeError` usually mean the control node or target locale is not UTF-8. Set `LC_ALL=C.UTF-8` (or `en_US.UTF-8`) for the shell that runs Ansible and for the remote session.'},
{code:`export LC_ALL=C.UTF-8
export LANG=C.UTF-8`},
{note:'When in doubt, run the failing command by hand over SSH with the same user. If it fails there, the problem is not Ansible.'}],
src:[['Troubleshooting FAQ',D+'reference_appendices/faq.html'],['Interpreter discovery',D+'reference_appendices/interpreter_discovery.html']]};

/* ---------- 2: Slow playbooks ---------- */
L['ansible:13:2']={blocks:[
{p:'A slow playbook costs time on every change and slows incident response. The method is always the same: **measure**, find the biggest cost, fix it, measure again.'},
{h:'Step 1: measure'},
{code:`# ansible.cfg
[defaults]
callbacks_enabled = ansible.posix.profile_tasks, ansible.posix.timer`},
{code:`Gathering Facts ------------------------------ 21.47s
Install packages ----------------------------- 14.22s
Deploy configuration -------------------------- 9.10s
Wait for service ------------------------------- 5.03s
Playbook run took 0 days, 0 hours, 1 minutes, 12 seconds`},
{h:'Step 2: find the pattern'},
{t:[['Finding','Likely reason','Fix'],
['Gathering Facts dominates','Setup runs for every play and host','`gather_facts: false`, smart gathering with cache, `gather_subset`'],
['Many tiny tasks','Per-task SSH and Python startup','Use list arguments, fewer tasks, templates instead of many `lineinfile`'],
['Loops over packages or files','One call per item','Pass the whole list to the module'],
['One slow host stalls the play','`linear` strategy waits','`strategy: free` for independent tasks'],
['Long command waits','Blocking SSH session','`async` and `poll`'],
['Slow connection setup','No connection reuse','`ControlPersist`, `pipelining`'],
['Large inventory with small forks','Low parallelism','Increase `forks` sensibly']]},
{h:'Design for speed'},
{code:`# slow: one call per package
- ansible.builtin.package:
    name: "{{ item }}"
    state: present
  loop: [git, curl, tmux]

# fast: one call
- ansible.builtin.package:
    name: [git, curl, tmux]
    state: present`},
{ul:['Gather facts **once**, in the first play, and reuse them; or cache them.','Avoid multiple plays that each target the same hosts without a reason; each play opens its own connections and gathers facts.','Use `unarchive` or `synchronize` for directory trees instead of hundreds of `copy` tasks.','Avoid `shell` with heavy pipelines on every host; do the work once with `run_once` or on the control node.']},
{flow:['Run with profile_tasks','Fix the top one or two items only','Run again and compare','Stop when the remaining time is acceptable']},
{note:'Speed is only worth buying while it stays safe. Do not remove health checks or serial batches to save seconds on a production rollout.'}],
src:[['Playbook strategies',UG+'playbooks_strategies.html'],['Asynchronous actions',UG+'playbooks_async.html']]};

/* ---------- 3: Style guide ---------- */
L['ansible:13:3']={blocks:[
{p:'Consistent style makes automation readable by people other than its author, which is the real test of maintainability. These conventions are widely used and align with what linters check.'},
{h:'The mindset'},
{ul:['**Optimise for readability.** Someone will read this at 3am.','**Declarative** over procedural: say what, not how.','**Simple** beats clever. Complexity kills productivity.','**Test** what you automate; prove it, do not assume.']},
{h:'Conventions'},
{t:[['Area','Do','Avoid'],
['Task names','Sentence case, describe the outcome: "Install nginx"','No names, or "Run command"'],
['Modules','FQCN: `ansible.builtin.copy`','Short names, `command` when a module exists'],
['State','Explicit `state:`','Relying on defaults silently'],
['Variables','`snake_case`, prefixed by role or purpose','Short names such as `x`, global collisions'],
['Booleans','`true` and `false`','`yes`, `no`, `on`, `off`'],
['Quoting','Quote strings that could be misread, file modes','Unquoted `0644`, versions'],
['Data','In group_vars and defaults','Hard-coded in tasks'],
['Secrets','Vault or external store, `no_log`','Plain text, debug output'],
['Logic','Small roles, clear interfaces','Giant playbooks with hundreds of tasks'],
['Comments','Explain **why**','Restating what the task does']]},
{h:'Documentation habits'},
{ul:['A README per role: purpose, variables with defaults, example, requirements.','Document inventory structure and how to run common operations.','Keep a `CHANGELOG` or release notes.']},
{h:'Review habits'},
{flow:['Does it follow the style and pass the linter?','Is it idempotent and safe in check mode?','Is the blast radius understood (hosts, serial)?','Is rollback clear?','Is it tested or verified?']},
{h:'Anti-patterns to avoid'},
{t:[['Anti-pattern','Why it hurts'],
['Editing servers by hand and not updating the code','Drift returns, automation lies'],
['`ignore_errors: true` as a default','Failures are hidden'],
['One giant `site.yml` with everything','Impossible to test or reuse'],
['Copy-pasted playbooks per environment','Environments diverge'],
['`state: latest` in production','Unplanned upgrades'],
['Secrets in the repository in plain text','Breach waiting to happen']]},
{note:'Style is a team agreement. Write it down, enforce the mechanical parts with ansible-lint and yamllint, and spend review time on design and risk.'}],
src:[['Ansible best practices',UG+'playbooks_best_practices.html'],['ansible-lint rules',K.LINT+'rules/']]};

/* ---------- 4: Capstone ---------- */
L['ansible:13:4']={blocks:[
{p:'The capstone ties every section together. You will automate a small but complete platform from an empty inventory to a tested pipeline. Treat it as a portfolio piece and build it incrementally.'},
{svg:capstone},
{h:'Requirements'},
{t:[['Area','Requirement'],
['Platform','Load balancer (nginx), two application servers, one PostgreSQL database'],
['Environments','`dev` and `staging` inventories using the same code'],
['Security','SSH hardening, vaulted secrets, `no_log` on sensitive tasks, firewall rules'],
['Operations','Rolling deploy with health checks, nightly database backup, node monitoring'],
['Quality','ansible-lint and yamllint clean, Molecule tests for at least two roles'],
['Delivery','CI pipeline running lint and tests on pull requests; documented promotion steps']]},
{h:'Milestones'},
{t:[['#','Milestone','Sections used'],
['1','Lab with four nodes, inventory, ansible.cfg, connectivity','1 to 3'],
['2','Baseline role: users, SSH, packages, time sync','4 to 6, 10'],
['3','Database role with users, databases and backups','6, 8, 11'],
['4','App role with release directories and templates','6 to 8, 11'],
['5','Load balancer role that builds its pool from inventory groups','6, 8'],
['6','Rolling deploy playbook with serial, health checks and rollback','7'],
['7','Vault for secrets, no_log, least-privilege account','10'],
['8','Linting, Molecule, CI pipeline','12'],
['9','Documentation and a short runbook','14']]},
{h:'Skeleton'},
{code:`# playbooks/site.yml
- name: Baseline for every host
  hosts: all
  become: true
  roles: [common, hardening, monitoring_agent]

- name: Database
  hosts: db
  become: true
  roles: [postgresql]

- name: Application tier
  hosts: app
  become: true
  serial: 1
  roles: [app]

- name: Load balancer
  hosts: lb
  become: true
  roles: [loadbalancer]`},
{h:'Acceptance checklist'},
{ul:['A second run of `site.yml` reports `changed=0`.','Destroying one app server and re-running restores the platform.','`--check --diff` shows no changes on a converged environment.','A deployment of a new release causes no failed requests (use a simple loop of requests to test).','No secrets appear in the repository or in output.','The pipeline blocks a change that breaks lint or a role test.']},
{note:'Keep a short design note for each decision (for example why `serial: 1`). Explaining your choices is exactly what an interviewer or reviewer asks about.'}],
src:[['Ansible user guide',UG+'index.html']]};

/* ---------- 5: Exam walkthrough ---------- */
L['ansible:13:5']={blocks:[
{p:'The **Red Hat Certified Engineer (RHCE) EX294** exam is hands-on: you are given managed nodes and a list of tasks and must complete them within the time limit, with the system in the right end state. This lecture maps the exam skill areas to this course and gives a practice routine.'},
{h:'Skill areas and where they are taught'},
{t:[['Exam skill area (summary)','Course section'],
['Core components: inventories, modules, variables, facts, plays, playbooks, configuration files','1 to 6'],
['Install and configure a control node; static inventory; ansible.cfg; manage parallelism','2, 3, 13'],
['Configure managed nodes: SSH keys, privilege escalation, deploy files, analyse facts','2, 4'],
['Script administration tasks: shell scripts running ad-hoc commands and playbooks','4, 5'],
['Create plays and playbooks: modules, conditionals, error handling, tags, templates','5 to 7'],
['Roles: create, download from Galaxy, use','8'],
['Collections and content navigator; documentation with `ansible-doc`','4, 9'],
['Ansible Vault in playbooks','10'],
['System administration modules: packages, services, firewall, file systems, storage, archiving, scheduled tasks, users and groups, SELinux','4, 6, 8, 11']]},
{note:'The list above is a summary based on public information about the exam. Objectives change between exam versions, so always check the current objectives on Red Hat\'s official exam page.'},
{h:'Practice set'},
{t:[['Task','Hint'],
['Create a role that installs and enables a web server and deploys a templated index page','`ansible-galaxy init`, `template`, handlers'],
['Write a playbook that creates users from a list, in groups chosen by a variable','`loop`, `user`, `group`, `group_vars`'],
['Encrypt a variables file and use it in a playbook','`ansible-vault`, `vars_files`'],
['Install packages on only the hosts in group `dev` and `prod` but not `test`','Pattern `dev:prod`, or `when`'],
['Collect free memory facts and write a report file to the control node','`setup`, `template` to localhost, `delegate_to`'],
['Configure a cron job and a systemd timer','`ansible.builtin.cron`, `systemd_service`'],
['Create a logical volume and mount it','`community.general.lvg`, `lvol`, `filesystem`, `ansible.posix.mount`'],
['Set an SELinux boolean and a file context','`ansible.posix.seboolean`, `community.general.sefcontext`, then `restorecon` with `command`'],
['Open firewall ports permanently','`ansible.posix.firewalld` with `permanent` and `immediate`'],
['Install a role from a requirements file','`ansible-galaxy install -r`']]},
{h:'Exam technique'},
{flow:['Read all tasks and plan the order; do prerequisites first','Use ansible-doc to look up module options offline','Write small playbooks, run them, move on','Check the end state; run twice to confirm idempotence','Re-run everything from a clean state if time allows']},
{h:'Habits that help'},
{ul:['Know `ansible-doc` thoroughly: `-s`, `-l`, searching options and examples.','Practise typing playbooks without copy and paste.','Prefer modules to shell; the exam checks the end state, and good modules are faster to get right.','Know how the system comes up after a reboot: services enabled, mounts persistent, firewall permanent.']},
{note:'Practice on a fresh set of VMs that you can rebuild. Time yourself on the practice set above and aim to finish with minutes to spare for checking.'}],
src:[['RHCE EX294 exam page','https://www.redhat.com/en/services/training/ex294-red-hat-certified-engineer-rhce-exam-red-hat-enterprise-linux-9'],['ansible-doc',K.CLI+'ansible-doc.html']]};
})();
