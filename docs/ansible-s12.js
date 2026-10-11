/* LearnSphere - Ansible, Section 12: Testing, Quality & CI/CD.
   Lectures 0-5 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG;

/* ---------- diagrams ---------- */
const pyramid=K.dg(700,230,[
[10,10,680,210,'Testing layers, cheapest first',1],
[240,40,220,40,'Syntax and lint',2],[190,90,320,40,'Check mode and idempotence',0],[140,140,420,40,'Molecule: converge, idempotence, verify',0],[90,190,520,30,'Staging run against realistic hosts',0]],
[]);

const molFlow=K.dg(700,160,[
[10,10,680,140,'molecule test sequence',1],
[25,60,90,50,'create',0],[135,60,100,50,'prepare',0],[255,60,100,50,'converge',2],[375,60,110,50,'idempotence',2],[505,60,80,50,'verify',2],[605,60,70,50,'destroy',0]],
[[115,85,135,85],[235,85,255,85],[355,85,375,85],[485,85,505,85],[585,85,605,85]]);

const pipeFlow=K.dg(700,170,[
[10,10,680,150,'Pipeline gating a pull request',1],
[25,60,110,50,'Pull request',0],[165,60,110,50,'yamllint|ansible-lint',2],[305,60,110,50,'syntax-check',0],[445,60,110,50,'molecule test',2],[585,60,90,50,'Merge',0]],
[[135,85,165,85],[275,85,305,85],[415,85,445,85],[555,85,585,85]]);

const promo=K.dg(700,200,[
[10,10,680,180,'Build once, promote the same content',1],
[30,70,110,60,'Git tag|v1.4.0',2],[180,70,120,60,'dev|auto deploy',0],[340,70,130,60,'staging|auto + tests',0],[510,70,160,60,'prod|approval, serial',2]],
[[140,100,180,100],[300,100,340,100],[470,100,510,100]]);

/* ---------- 0: Linting ---------- */
L['ansible:11:0']={blocks:[
{p:'**Linting** checks automation code without running it. It catches bugs, risky patterns and style problems in seconds, long before they reach a server. Two tools cover most needs: **yamllint** for YAML formatting and **ansible-lint** for Ansible practice.'},
{svg:pyramid},
{h:'ansible-lint'},
{code:`pip install ansible-lint
ansible-lint                     # lint the whole project
ansible-lint site.yml roles/web  # specific paths
ansible-lint --fix               # apply safe automatic fixes`},
{code:`WARNING  Listing 2 violation(s) that are fatal
roles/web/tasks/main.yml:7: fqcn[action-core]: Use FQCN for builtin module actions (copy).
roles/web/tasks/main.yml:12: no-changed-when: Commands should not change things if nothing needs doing.`},
{h:'Common rules'},
{t:[['Rule','Meaning','Fix'],
['`fqcn`','Use fully qualified module names','`ansible.builtin.copy`'],
['`name[missing]`, `name[casing]`','Tasks need names, capitalised','Add `name:`'],
['`no-changed-when`','`command` without `changed_when`','Add `changed_when` or `creates`'],
['`risky-shell-pipe`','Pipe in `shell` without `pipefail`','`set -o pipefail`, or avoid the pipe'],
['`yaml[...]`','Formatting problems','Run `yamllint` and fix'],
['`no-handler`','A task that should be a handler','Use `notify`'],
['`package-latest`','`state: latest` on packages','Use `present` or pin']]},
{h:'Profiles'},
{t:[['Profile','Strictness'],
['`min`','Rules that stop Ansible from running'],
['`basic`','Plus common problems'],
['`moderate`','Plus readability and naming'],
['`safety`','Plus risky behaviour'],
['`shared`','Content meant for sharing'],
['`production`','Everything, for Galaxy-quality roles']]},
{h:'Configuration'},
{code:`# .ansible-lint
profile: moderate
exclude_paths:
  - .cache/
  - collections/
skip_list:
  - yaml[line-length]
warn_list:
  - experimental`},
{code:`# .yamllint
extends: default
rules:
  line-length:
    max: 160
  truthy:
    allowed-values: ["true", "false"]`},
{h:'Suppressing a finding'},
{code:`- name: Legacy command we cannot change yet   # noqa: no-changed-when
  ansible.builtin.command: /opt/legacy/run`},
{note:'Treat a suppression as technical debt: add a comment saying why. Start strict on new code and use `warn_list` to improve legacy code gradually.'}],
src:[['ansible-lint',K.LINT],['yamllint','https://yamllint.readthedocs.io/']]};

/* ---------- 1: Dry runs and idempotence ---------- */
L['ansible:11:1']={blocks:[
{p:'Before real systems are touched, three cheap checks give strong confidence. They also form the backbone of automated tests.'},
{h:'Layers of dry run'},
{t:[['Check','Command','Finds'],
['Syntax','`ansible-playbook site.yml --syntax-check`','YAML and structure errors'],
['Preview','`ansible-playbook site.yml --check --diff`','What would change, file diffs'],
['Idempotence','Run twice, expect `changed=0`','Non-idempotent tasks'],
['Assertions','`assert` tasks after the change','Wrong end state']]},
{h:'Idempotence as an automated test'},
{code:`#!/bin/sh
set -e
ansible-playbook -i inventory/lab site.yml                 # first run: apply
out=$(ansible-playbook -i inventory/lab site.yml | tee /dev/stderr)
echo "$out" | grep -E 'changed=[1-9]' && { echo "NOT IDEMPOTENT"; exit 1; }
echo "Idempotent"`},
{p:'Any task that reports changed on the second run has a problem: a `command` without `changed_when`, a template with a timestamp, or a module used with a state that never settles.'},
{h:'Typical causes and fixes'},
{t:[['Symptom','Cause','Fix'],
['`command` always changed','No state detection','`creates`, `removes`, `changed_when`'],
['Template changes every run','Timestamp, random value or ordered dict','Remove it; sort data'],
['Package `latest`','New version appeared','Pin or use `present`'],
['User password changed','Random salt in hash','Fixed salt, `update_password: on_create`'],
['Service restarted each run','Restart in a task, not a handler','Use `notify` and a handler']]},
{h:'Limits of check mode'},
{ul:['Tasks that depend on earlier changes may fail in check mode, for example starting a service whose package would have been installed.','`command` and `shell` are skipped unless you opt in.','Check mode is a **prediction**; it cannot prove behaviour.']},
{code:`- name: Safe query that should run in check mode too
  ansible.builtin.command: nginx -t
  changed_when: false
  check_mode: false`},
{note:'The pair "second run changed=0" and "assertions pass" is the closest thing to a unit test for infrastructure code. Molecule runs both for you on a throwaway instance.'}],
src:[['Validating tasks: check mode and diff mode',UG+'playbooks_checkmode.html'],['Testing strategies',UG+'test_strategies.html']]};

/* ---------- 2: Molecule ---------- */
L['ansible:11:2']={blocks:[
{p:'**Molecule** tests roles and collections by creating a throwaway instance, running your code on it, checking that it is idempotent and verifying the result. It is the standard framework for Ansible content testing.'},
{svg:molFlow},
{h:'Scenario layout'},
{code:`roles/webserver/
  tasks/main.yml
  molecule/
    default/
      molecule.yml     # platforms, driver, options
      converge.yml     # applies the role
      verify.yml       # checks the result`},
{h:'molecule.yml'},
{code:`driver:
  name: docker
platforms:
  - name: instance
    image: geerlingguy/docker-ubuntu2204-ansible:latest
    pre_build_image: true
    privileged: true
    cgroupns_mode: host
    volumes:
      - /sys/fs/cgroup:/sys/fs/cgroup:rw
    command: ""
provisioner:
  name: ansible
verifier:
  name: ansible`},
{h:'converge.yml and verify.yml'},
{code:`# converge.yml
- name: Converge
  hosts: all
  become: true
  roles:
    - role: webserver
      vars:
        webserver_message: "Molecule test"

# verify.yml
- name: Verify
  hosts: all
  gather_facts: false
  tasks:
    - name: Fetch the page
      ansible.builtin.uri:
        url: http://localhost/
        return_content: true
      register: page

    - name: Assert content
      ansible.builtin.assert:
        that: "'Molecule test' in page.content"`},
{h:'Commands'},
{t:[['Command','Purpose'],
['`molecule init scenario`','Create a scenario'],
['`molecule converge`','Create the instance and apply the role (fast loop)'],
['`molecule verify`','Run verification only'],
['`molecule login`','Open a shell inside the instance'],
['`molecule test`','Complete cycle with destroy at the end (CI)'],
['`molecule destroy`','Clean up']]},
{code:`pip install molecule "molecule-plugins[docker]" ansible-lint
molecule test`},
{h:'What the test sequence proves'},
{flow:['create: a clean instance exists','converge: the role applies without error','idempotence: second converge reports no changes','verify: the end state is as expected','destroy: nothing is left behind']},
{h:'Matrix testing'},
{p:'List several platforms in `molecule.yml` (for example Ubuntu 22.04, Rocky 9) and the same scenario runs on each, which is how a role proves it is portable.'},
{note:'Use images designed for testing with systemd, as plain `ubuntu` images do not run services. Docker or Podman drivers need the matching Python plugin installed.'}],
src:[['Molecule',K.MOL],['Molecule getting started',K.MOL+'getting-started/']]};

/* ---------- 3: Project layout ---------- */
L['ansible:11:3']={blocks:[
{p:'Automation code is code. It benefits from the same repository conventions and review practices as application code. A predictable layout lets anyone find things and lets tools do their job.'},
{h:'A proven repository layout'},
{code:`ansible-platform/
  ansible.cfg
  requirements.yml            # roles and collections, pinned
  requirements.txt            # Python dependencies
  .ansible-lint
  .yamllint
  inventories/
    dev/        hosts.yml  group_vars/  host_vars/
    staging/    hosts.yml  group_vars/  host_vars/
    prod/       hosts.yml  group_vars/  host_vars/
  playbooks/
    site.yml
    deploy.yml
    patch.yml
  roles/
    common/
    webserver/
    hardening/
  collections/                # git-ignored; installed from requirements
  README.md
  .github/workflows/ci.yml`},
{h:'Conventions'},
{t:[['Area','Convention'],
['Playbooks','Short and readable; logic lives in roles'],
['Variables','Environment data in `group_vars`; secrets in vault files'],
['Names','`snake_case`, role-prefixed variables, tasks named in sentence case'],
['Secrets','Never in plain text; secret scanning on the repository'],
['Dependencies','Pinned in `requirements.yml` and `requirements.txt`'],
['Docs','README per role: purpose, variables, example']]},
{h:'Version control practice'},
{ul:['**Branch and pull request** for every change; direct pushes to the main branch are blocked.','At least **one reviewer**; use CODEOWNERS for sensitive areas such as production inventories.','Small, focused commits with a clear message about **why**.','Require passing checks (lint, tests) before merge.','Tag releases (see the promotion lecture).']},
{h:'Review checklist'},
{flow:['Is it idempotent and does it support check mode?','Are secrets handled with vault and no_log?','Does it use FQCNs, names and tags?','Are variables documented and prefixed?','Is there a test or at least a verification step?']},
{code:`# .gitignore
collections/
*.retry
.vault_pass
.vault_*
.cache/
.molecule/`},
{note:'A good first review question is: "How would I roll this back?" If the answer is unclear, the change is not ready.'}],
src:[['Sample setup and best practices',UG+'sample_setup.html'],['Tips and tricks',UG+'playbooks_best_practices.html']]};

/* ---------- 4: CI ---------- */
L['ansible:11:4']={blocks:[
{p:'A pipeline turns your checks into an automatic gate: nothing merges unless lint and tests pass. This removes "works on my machine" and enforces the standard for everyone.'},
{svg:pipeFlow},
{h:'GitHub Actions'},
{code:`# .github/workflows/ci.yml
name: ansible-ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
      - run: pip install -r requirements.txt
      - run: ansible-galaxy collection install -r requirements.yml -p collections
      - run: yamllint .
      - run: ansible-lint
      - run: ansible-playbook playbooks/site.yml -i inventories/dev --syntax-check

  molecule:
    runs-on: ubuntu-latest
    needs: lint
    strategy:
      matrix:
        role: [common, webserver, hardening]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt "molecule-plugins[docker]"
      - run: molecule test
        working-directory: roles/\${{ matrix.role }}`},
{h:'GitLab CI'},
{code:`# .gitlab-ci.yml
stages: [lint, test]

lint:
  stage: lint
  image: python:3.12
  script:
    - pip install -r requirements.txt
    - yamllint .
    - ansible-lint

molecule:
  stage: test
  image: python:3.12
  services: [docker:dind]
  variables:
    DOCKER_HOST: tcp://docker:2375
  script:
    - pip install -r requirements.txt "molecule-plugins[docker]"
    - cd roles/webserver && molecule test`},
{h:'Pipeline design'},
{t:[['Practice','Reason'],
['Fast checks first (lint, syntax)','Fail early and cheaply'],
['Pin tool versions','Pipeline results stay reproducible'],
['Cache pip and collections','Faster runs'],
['Matrix over roles and platforms','Parallel feedback'],
['Require checks on the main branch','Merge is a gate, not a suggestion'],
['Secrets from the CI secret store only','Never in the repository or logs']]},
{note:'Keep production deployment out of the pull-request pipeline. Merge triggers deployment to lower environments; production needs a protected job with approval (next lecture).'}],
src:[['GitHub Actions','https://docs.github.com/actions'],['Molecule in CI',K.MOL+'ci/']]};

/* ---------- 5: Releases and promotion ---------- */
L['ansible:11:5']={blocks:[
{p:'The most important principle of delivery is to **promote the same tested content** through environments. Do not rebuild or re-edit between dev and production. What passed staging is exactly what runs in production.'},
{svg:promo},
{h:'What gets versioned'},
{t:[['Artifact','How it is versioned'],
['Automation repository','Git tag, for example `v1.4.0`'],
['Roles and collections you publish','Semantic version in `galaxy.yml` or `meta/main.yml`'],
['Dependencies','Exact versions in `requirements.yml`'],
['Execution environment image','Image tag or digest'],
['Application build','Its own version, passed as a variable (`app_version`)']]},
{h:'Promotion flow'},
{flow:['Merge to main and tag a release candidate','Deploy to dev automatically; run smoke tests','Deploy the same tag to staging; run the full verification','Approve the change (manual gate or change ticket)','Deploy the same tag to production in batches (serial)']},
{h:'Environments differ by data, not by code'},
{code:`ansible-playbook -i inventories/dev     site.yml -e release=1.4.0
ansible-playbook -i inventories/staging site.yml -e release=1.4.0
ansible-playbook -i inventories/prod    site.yml -e release=1.4.0 --limit "web:&prod"`},
{h:'Rollback'},
{ul:['Redeploy the **previous tag**; since the process is idempotent this is the same job with an older version.','Keep the previous application release on the host (release directories) for a fast switch.','Test the rollback path in staging occasionally; an untested rollback is a hope.']},
{h:'Change records'},
{ul:['Use a changelog tool (for example `antsibull-changelog` for collections) or release notes generated from pull requests.','Link each production run to the tag, the pipeline job and the approver.']},
{note:'If hotfixes bypass the pipeline "just this once", environments drift and the promised guarantees disappear. Make the fast path the safe path instead: a short, trusted pipeline.'}],
src:[['Semantic versioning','https://semver.org/'],['Collection versioning',K.DEV+'dev_guide/developing_collections_distributing.html']]};
})();
