/* LearnSphere - Ansible, Section 09: Collections, Modules & Plugins.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,C=UG+'collections_using.html';

/* ---------- diagrams ---------- */
const fqcn=K.dg(700,170,[
[10,10,680,150,'Fully qualified collection name',1],
[40,60,130,55,'amazon|namespace',2],[200,60,130,55,'aws|collection',2],[360,60,130,55,'ec2_instance|module name',2],[540,60,130,55,'amazon.aws.|ec2_instance',0]],
[[170,88,200,88],[330,88,360,88],[490,88,540,88]]);

const collStruct=K.dg(700,230,[
[10,10,680,210,'ansible_collections/my_ns/my_col/',1],
[30,50,160,40,'galaxy.yml',2],[30,100,160,40,'plugins/modules/',0],[30,150,160,40,'plugins/filter/',0],
[230,50,160,40,'roles/',0],[230,100,160,40,'plugins/lookup/',0],[230,150,160,40,'plugins/module_utils/',0],
[430,50,240,40,'playbooks/ and docs/',0],[430,100,240,40,'tests/ (sanity, unit, integration)',0],[430,150,240,40,'meta/runtime.yml',0]],
[]);

/* ---------- 0: modules to collections ---------- */
L['ansible:8:0']={blocks:[
{p:'Early Ansible shipped thousands of modules in one package. That did not scale: every fix waited for a core release. Since version **2.10**, content is distributed as **collections** and the engine, **ansible-core**, keeps only a small built-in set.'},
{svg:fqcn},
{h:'What a collection is'},
{p:'A collection is a versioned bundle of content: modules, plugins, roles, playbooks and documentation. It has a **namespace** (usually the publisher) and a **name**.'},
{t:[['Part','Example','Meaning'],
['Namespace','`amazon`, `community`, `ansible`','Publisher or group'],
['Collection','`aws`, `general`, `posix`','The bundle'],
['Content','`ec2_instance`, `firewalld`','Module or plugin name'],
['**FQCN**','`amazon.aws.ec2_instance`','All three, always unambiguous']]},
{h:'Why to always use the FQCN'},
{code:`# works, but ambiguous: which "copy"?
- copy:
    src: a
    dest: /tmp/a

# clear and portable
- ansible.builtin.copy:
    src: a
    dest: /tmp/a`},
{ul:['Two collections can supply a module with the same short name.','Linters and documentation expect FQCNs.','It makes missing collections obvious instead of silently using another module.']},
{p:'The `collections:` keyword in a play lets you use short names, but it makes playbooks harder to read and is discouraged. Prefer FQCNs.'},
{h:'Where collections live'},
{code:`ansible-galaxy collection list
ansible-doc ansible.posix.firewalld      # docs for a module in a collection
ansible-doc -l ansible.posix             # list modules of a collection`},
{t:[['Location','Purpose'],
['`./collections/ansible_collections/`','Project-local (recommended)'],
['`~/.ansible/collections/ansible_collections/`','Per user'],
['`/usr/share/ansible/collections/`','System-wide, including bundled community content']]},
{note:'If you install the `ansible` community package, a large set of collections is already included. With `ansible-core` only `ansible.builtin` is present, and you install the others yourself.'}],
src:[['Using collections',C],['Developing collections',K.DEV+'dev_guide/developing_collections.html']]};

/* ---------- 1: Installing collections ---------- */
L['ansible:8:1']={blocks:[
{p:'Collections are installed with `ansible-galaxy collection`. For reliable automation the goals are: **explicit** (a requirements file), **pinned** (known versions) and **local** (in the project, not the system).'},
{h:'Install commands'},
{code:`ansible-galaxy collection install ansible.posix
ansible-galaxy collection install community.general:==9.0.1
ansible-galaxy collection install community.docker -p ./collections
ansible-galaxy collection install -r requirements.yml
ansible-galaxy collection install git+https://git.example.com/team/my_col.git,v1.2.0`},
{h:'requirements.yml'},
{code:`collections:
  - name: ansible.posix
    version: ">=1.5.0,<2.0.0"
  - name: community.general
    version: "9.0.1"
  - name: amazon.aws
    version: "8.2.1"
  - name: https://git.example.com/team/my_col.git
    type: git
    version: v1.2.0`},
{t:[['Version syntax','Meaning'],
['`"9.0.1"` or `==9.0.1`','Exactly this version'],
['`">=1.5.0,<2.0.0"`','Compatible range'],
['`"*"` (default)','Latest; avoid in production']]},
{h:'Keep collections in the project'},
{code:`# ansible.cfg
[defaults]
collections_path = ./collections

# then
ansible-galaxy collection install -r requirements.yml -p ./collections`},
{p:'The setting is `collections_path`, and it can also be a colon-separated list. Add `collections/` to `.gitignore`: commit the requirements file, not the content.'},
{h:'Dependencies of collections'},
{ul:['A collection can depend on other collections; `ansible-galaxy` installs them.','Collections may need **Python libraries** on the control node (boto3 for amazon.aws, pyvmomi for VMware). Check the `requirements.txt` of the collection.','Execution environments (Section 13) bundle both in one image.']},
{h:'Offline and verification'},
{code:`ansible-galaxy collection download -r requirements.yml -p ./offline
ansible-galaxy collection install -r offline/requirements.yml --offline
ansible-galaxy collection verify ansible.posix`},
{flow:['Add the collection to requirements.yml with a version','Install into ./collections','Run tests or --check','Commit requirements.yml','Update deliberately, reading the changelog first']},
{note:'CI should install from the same requirements file as developers. A job that installs latest on every run is a source of "it worked yesterday" failures.'}],
src:[['Installing collections',C+'#installing-collections'],['ansible-galaxy',K.CLI+'ansible-galaxy.html']]};

/* ---------- 2: Tour ---------- */
L['ansible:8:2']={blocks:[
{p:'With thousands of modules, the useful skill is knowing **which collection** to look in. This is a guided map of the ones you will meet most often.'},
{h:'Built-in and base'},
{t:[['Collection','Contents','Examples'],
['`ansible.builtin`','Always present with ansible-core','`copy`, `template`, `file`, `command`, `package`, `service`, `uri`, `debug`, `set_fact`'],
['`ansible.posix`','POSIX system tools','`authorized_key`, `firewalld`, `sysctl`, `mount`, `selinux`, `synchronize`'],
['`ansible.windows`','Windows modules','`win_feature`, `win_service`, `win_copy`'],
['`ansible.utils`, `ansible.netcommon`','Network and data utilities','`ipaddr` filters, `cli_parse`']]},
{h:'Community and infrastructure'},
{t:[['Collection','Contents'],
['`community.general`','Large catalogue: `ufw`, `timezone`, `nmcli`, `haproxy`, `ini_file`, many lookups and filters'],
['`community.crypto`','Certificates, keys and CSR handling'],
['`community.docker`','Containers, images, networks, compose'],
['`community.mysql`, `community.postgresql`','Database users, schemas and queries'],
['`community.vmware`','vSphere VMs and infrastructure'],
['`kubernetes.core`','Kubernetes objects, Helm, kubectl-like actions']]},
{h:'Cloud'},
{t:[['Collection','Provider'],
['`amazon.aws`, `community.aws`','AWS'],
['`azure.azcollection`','Microsoft Azure'],
['`google.cloud`','Google Cloud'],
['`openstack.cloud`','OpenStack'],
['`hetzner.hcloud`, `digitalocean.cloud`','Other providers']]},
{h:'Network vendors'},
{p:'Network gear has collections per platform, for example `cisco.ios`, `cisco.nxos`, `arista.eos`, `junipernetworks.junos` and `vyos.vyos`. They build on `ansible.netcommon`.'},
{h:'Certified vs community'},
{t:[['','Certified (Automation Hub)','Community (Galaxy)'],
['Support','Vendor and Red Hat supported','Best effort by maintainers'],
['Testing','Tested against product releases','Varies'],
['Use when','You have an Automation Platform subscription and need support','Learning, flexibility, broad coverage']]},
{h:'Finding the right module'},
{flow:['Search the Ansible docs or Galaxy for the task','Check the collection namespace and recent release date','ansible-galaxy collection install it into the project','ansible-doc namespace.collection.module for options','Test on a lab before relying on it']},
{note:'Before writing a long `command` task, search the collections first. A module that already handles idempotency and check mode is worth more than a clever script.'}],
src:[['Collection index',D+'collection_index.html'],['Ansible Galaxy','https://galaxy.ansible.com/']]};

/* ---------- 3: Plugin types ---------- */
L['ansible:8:3']={blocks:[
{p:'**Plugins** extend the engine itself. Unlike modules, which run on the target, plugins run on the **control node** and change how Ansible connects, formats output, finds data or transforms values.'},
{h:'The main plugin types'},
{t:[['Type','What it does','Example'],
['**Connection**','How Ansible reaches a host','`ssh`, `winrm`, `local`, `docker`'],
['**Become**','How privileges are escalated','`sudo`, `su`, `doas`'],
['**Callback**','Reacts to events and formats output','`default`, `json`, `profile_tasks`'],
['**Lookup**','Fetches data from outside, on the control node','`file`, `env`, `pipe`, `password`, `url`'],
['**Filter**','Transforms data in Jinja2','`to_nice_json`, `ipaddr`'],
['**Test**','Boolean checks in Jinja2','`is defined`, `is version`'],
['**Inventory**','Builds host lists','`aws_ec2`, `yaml`, `constructed`'],
['**Vars**','Adds variables from other sources','`host_group_vars`'],
['**Cache**','Stores facts or inventory','`jsonfile`, `redis`'],
['**Strategy**','How tasks are scheduled','`linear`, `free`'],
['**Action**','Runs code on the control node around a module','`template`, `copy` use action plugins']]},
{h:'Lookups'},
{p:'A lookup reads data **on the control node** at the time a value is needed.'},
{code:`# read a local file
motd: "{{ lookup('ansible.builtin.file', 'files/motd.txt') }}"

# environment variable of the control node
home: "{{ lookup('ansible.builtin.env', 'HOME') }}"

# generate and store a random password once
db_pass: "{{ lookup('ansible.builtin.password', 'secrets/db.pass length=24') }}"

# many results as a list
all_files: "{{ query('ansible.builtin.fileglob', 'files/*.conf') }}"`},
{t:[['Function','Returns'],
['`lookup(...)`','A string (comma-joined when several)'],
['`query(...)` or `q(...)`','Always a list']]},
{h:'Enabling and configuring'},
{ul:['Most plugins are available as soon as the collection is installed.','**Callbacks** that only notify must be enabled with `callbacks_enabled`.','Options are set in `ansible.cfg`, environment variables or play and task keywords as the plugin documents.']},
{code:`ansible-doc -t lookup -l                         # list lookup plugins
ansible-doc -t lookup ansible.builtin.password   # read its options
ansible-doc -t callback -l
ansible-doc -t connection -l`},
{note:'Lookups run on the **control node**, not on the managed host. To read a file on the target, use the `slurp` or `command` module instead.'}],
src:[['Working with plugins',D+'plugins/plugins.html'],['Lookups',UG+'playbooks_lookups.html']]};

/* ---------- 4: Callbacks ---------- */
L['ansible:8:4']={blocks:[
{p:'**Callback plugins** receive events from a run (play start, task result, recap). They control how output looks and can send results elsewhere. They are your window into what happened and how long it took.'},
{h:'Two kinds'},
{t:[['Kind','Role','Setting'],
['**stdout** callback','The main console output; only one is active','`stdout_callback`'],
['**Notification** callbacks','Add extra behaviour: timing, logging, metrics','`callbacks_enabled`']]},
{h:'A useful configuration'},
{code:`# ansible.cfg
[defaults]
stdout_callback = ansible.builtin.default
callback_result_format = yaml         # readable multi-line results
callbacks_enabled = ansible.posix.profile_tasks, ansible.posix.timer
display_skipped_hosts = false`},
{h:'Timing and profiling'},
{code:`PLAYBOOK: site.yml *****
Thursday 11 October 2026  10:15:22 +0000 (0:00:03.411)       0:00:41.870 ****
===============================================================================
Install packages ---------------------------------------------- 18.42s
Gathering Facts ----------------------------------------------- 6.31s
Deploy configuration ------------------------------------------ 2.07s`},
{t:[['Callback','Result'],
['`ansible.posix.profile_tasks`','Time per task and a sorted summary of the slowest'],
['`ansible.posix.profile_roles`','Time per role'],
['`ansible.posix.timer`','Total run time'],
['`ansible.posix.json` / `jsonl`','Machine-readable output for tools and CI'],
['`ansible.builtin.minimal`, `oneline`','Compact output for ad-hoc'],
['`community.general.junit`','JUnit XML for CI test reports']]},
{h:'Using JSON output in a pipeline'},
{code:`ANSIBLE_STDOUT_CALLBACK=ansible.posix.json \\
  ansible-playbook site.yml --check > result.json

# parse with jq: hosts that would change
jq '.stats | to_entries[] | select(.value.changed > 0) | .key' result.json`},
{h:'Choosing'},
{flow:['Reading output at a terminal: default with yaml result format','Finding slow tasks: profile_tasks','CI reports: json or junit','Audit trail: send to a log with a notification callback or use AWX job output']},
{note:'Callbacks only see what Ansible prints. Secrets in task output can reach these logs, so mark sensitive tasks with `no_log: true` (Section 10).'}],
src:[['Callback plugins',D+'plugins/callback.html'],['ansible.posix collection','https://docs.ansible.com/ansible/latest/collections/ansible/posix/index.html']]};

/* ---------- 5: Custom module ---------- */
L['ansible:8:5']={blocks:[
{p:'When no module does what you need, a custom module is better than a pile of `command` tasks, because it is idempotent, supports check mode and returns structured data. Modules can be written in Python and are small.'},
{h:'Where to put it'},
{t:[['Location','Use'],
['`library/` next to the playbook or inside a role','Quick local module'],
['`plugins/modules/` in a collection','Shareable, versioned module (recommended for reuse)']]},
{h:'A minimal module'},
{code:`#!/usr/bin/python
# library/stamp_file.py
from ansible.module_utils.basic import AnsibleModule

DOCUMENTATION = r'''
module: stamp_file
short_description: Ensure a file contains given text
options:
  path:
    description: File to manage
    required: true
    type: path
  text:
    description: Text the file must contain
    required: true
    type: str
'''

def main():
    module = AnsibleModule(
        argument_spec=dict(
            path=dict(type='path', required=True),
            text=dict(type='str', required=True),
        ),
        supports_check_mode=True,
    )
    path = module.params['path']
    text = module.params['text']

    try:
        with open(path) as fh:
            current = fh.read()
    except FileNotFoundError:
        current = None

    changed = current != text

    if changed and not module.check_mode:
        with open(path, 'w') as fh:
            fh.write(text)

    module.exit_json(changed=changed, path=path)

if __name__ == '__main__':
    main()`},
{code:`- name: Use the custom module
  stamp_file:
    path: /etc/build-id
    text: "build 1423\\n"`},
{h:'The pattern every module follows'},
{flow:['Declare the argument_spec (names, types, required)','Read the current state','Compare with the desired state','Change only if needed and not in check mode','Return changed and useful data with exit_json, or fail_json']},
{h:'Rules that keep modules good'},
{ul:['Be **idempotent**: a second run must report `changed=False`.','Support **check mode**: compute but do not change.','Validate input with `argument_spec` instead of manual checks.','Use `fail_json(msg=...)` for errors; never print or exit raw.','Document with `DOCUMENTATION`, `EXAMPLES` and `RETURN` so `ansible-doc` works.']},
{h:'Test quickly'},
{code:`# run the module directly with arguments, no playbook
ansible localhost -m stamp_file -a "path=/tmp/x text=hello" --check
ansible localhost -m stamp_file -a "path=/tmp/x text=hello"
ansible localhost -m stamp_file -a "path=/tmp/x text=hello"   # changed: false`},
{note:'Put shared code in `module_utils` so several modules reuse it. For anything that wraps a REST API, consider whether the `uri` module is enough before writing a module.'}],
src:[['Developing modules',K.DEV+'dev_guide/developing_modules_general.html'],['Module best practices',K.DEV+'dev_guide/developing_modules_best_practices.html']]};

/* ---------- 6: Custom filter / lookup ---------- */
L['ansible:8:6']={blocks:[
{p:'Filters and lookups are small Python plugins. A filter transforms a value in Jinja2; a lookup fetches data. Both run on the control node. Writing one is often cleaner than a complicated expression repeated in many places.'},
{h:'A filter plugin'},
{code:`# filter_plugins/size.py   (next to the playbook, or in a role)
from ansible.errors import AnsibleFilterError

def human_size(value):
    try:
        size = float(value)
    except (TypeError, ValueError):
        raise AnsibleFilterError('human_size expects a number')
    for unit in ('B', 'KiB', 'MiB', 'GiB', 'TiB'):
        if size < 1024 or unit == 'TiB':
            return '%.1f %s' % (size, unit)
        size /= 1024

class FilterModule(object):
    def filters(self):
        return {'human_size': human_size}`},
{code:`- name: Show memory nicely
  ansible.builtin.debug:
    msg: "{{ (ansible_facts['memtotal_mb'] * 1048576) | human_size }}"
# 3.8 GiB`},
{h:'A lookup plugin'},
{code:`# lookup_plugins/upper_env.py
from ansible.plugins.lookup import LookupBase
import os

class LookupModule(LookupBase):
    def run(self, terms, variables=None, **kwargs):
        results = []
        for name in terms:
            results.append(os.environ.get(name, '').upper())
        return results`},
{code:`msg: "{{ lookup('upper_env', 'USER') }}"`},
{h:'Packaging them in a collection'},
{svg:collStruct},
{t:[['Plugin type','Directory in a collection','Called as'],
['Filter','`plugins/filter/`','`namespace.collection.filter_name`'],
['Lookup','`plugins/lookup/`','`lookup("namespace.collection.name")`'],
['Module','`plugins/modules/`','`namespace.collection.module`'],
['Test','`plugins/test/`','`is namespace.collection.test`']]},
{h:'Build and share'},
{code:`# galaxy.yml defines namespace, name, version
ansible-galaxy collection build
ansible-galaxy collection install my_ns-my_col-1.0.0.tar.gz -p ./collections`},
{note:'Keep plugins small and well tested with unit tests. A plugin that grows into business logic usually belongs in a module or a separate service.'}],
src:[['Developing plugins',K.DEV+'dev_guide/developing_plugins.html'],['Developing collections',K.DEV+'dev_guide/developing_collections.html']]};
})();
