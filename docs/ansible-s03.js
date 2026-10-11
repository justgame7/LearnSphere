/* LearnSphere - Ansible, Section 03: Inventory & Targeting.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,INV=K.INV;

/* ---------- diagrams ---------- */
const groups=K.dg(700,290,[
[10,10,680,270,'Group tree',1],
[270,35,160,40,'all',2],
[60,110,150,40,'prod',0],[270,110,160,40,'staging',0],[490,110,150,40,'ungrouped',0],
[20,190,110,40,'web',0],[150,190,110,40,'db',0],[290,190,120,40,'web',0],[510,190,110,40,'lonely1',0]],
[[330,75,135,110],[350,75,350,110],[380,75,565,110],[100,150,75,190],[165,150,205,190],[330,150,350,190],[565,150,565,190]]);

const varLoad=K.dg(700,200,[
[10,10,680,180,'Where variables for web1 come from',1],
[30,60,130,50,'group_vars/all',0],[180,60,130,50,'group_vars/web',0],[330,60,130,50,'host_vars/web1',2],[500,60,170,50,'Merged variables|for web1',2]],
[[160,85,180,85],[310,85,330,85],[460,85,500,85]]);

const layout=K.dg(700,230,[
[10,10,680,210,'One inventory per environment',1],
[30,55,200,50,'inventories/',0],
[30,125,180,40,'dev/hosts',0],[250,125,180,40,'staging/hosts',0],[470,125,180,40,'prod/hosts',2],
[30,180,180,30,'group_vars/ host_vars/',0],[250,180,180,30,'group_vars/ host_vars/',0],[470,180,180,30,'group_vars/ host_vars/',0]],
[[130,105,120,125],[130,105,340,125],[130,105,560,125]]);

/* ---------- 0: Static inventory ---------- */
L['ansible:2:0']={blocks:[
{p:'The **inventory** tells Ansible which machines exist and how to reach them. The simplest form is a static text file in **INI** or **YAML** format. Both describe the same data.'},
{h:'INI format'},
{code:`# inventory.ini
mail.example.com

[web]
web1.example.com
web2.example.com ansible_port=2222

[db]
db1.example.com ansible_host=10.0.0.21 ansible_user=dbadmin

[web:vars]
ansible_python_interpreter=/usr/bin/python3`},
{h:'The same inventory in YAML'},
{code:`# inventory.yml
all:
  hosts:
    mail.example.com:
  children:
    web:
      hosts:
        web1.example.com:
        web2.example.com:
          ansible_port: 2222
      vars:
        ansible_python_interpreter: /usr/bin/python3
    db:
      hosts:
        db1.example.com:
          ansible_host: 10.0.0.21
          ansible_user: dbadmin`},
{t:[['','INI','YAML'],
['Readability for small files','Very good','Good'],
['Nested data (lists, dicts)','Awkward','Natural'],
['Same format as playbooks','No','Yes'],
['Typical use','Quick labs, simple fleets','Larger or structured inventories']]},
{h:'Connection variables'},
{t:[['Variable','Purpose','Example'],
['`ansible_host`','Real address when the name is not resolvable','`10.0.0.21`'],
['`ansible_port`','SSH port','`2222`'],
['`ansible_user`','Login user','`ansible`'],
['`ansible_connection`','Connection plugin','`ssh`, `local`, `winrm`'],
['`ansible_ssh_private_key_file`','Key for this host','`~/.ssh/prod_key`'],
['`ansible_python_interpreter`','Python on the target','`/usr/bin/python3`'],
['`ansible_become` / `ansible_become_method`','Privilege escalation defaults','`true`, `sudo`']]},
{h:'Ranges and aliases'},
{code:`[web]
web[01:20].example.com     # web01 to web20

[cache]
c-a ansible_host=10.1.0.5  # alias: c-a, real address 10.1.0.5`},
{h:'Using an inventory'},
{code:`ansible -i inventory.ini web -m ansible.builtin.ping
# or set  inventory = ./inventory.ini  in ansible.cfg`},
{h:'The implicit localhost'},
{p:'Ansible always knows about **localhost**, connected with `ansible_connection=local`, even if it is not in the file. It is only matched when you name it explicitly, **not** by `all`.'},
{note:'Use the name that is useful to humans as the inventory name and put the real address in `ansible_host`. Names appear in output and in the variable `inventory_hostname`.'}],
src:[['Building an inventory',INV],['Connection variables',UG+'intro_inventory.html#connecting-to-hosts-behavioral-inventory-parameters']]};

/* ---------- 1: Groups ---------- */
L['ansible:2:1']={blocks:[
{p:'Groups let you target and configure many hosts at once. The usual approach is to group by **function** (web, db), by **environment** (prod, staging) and sometimes by **location** (eu, us). A host can belong to any number of groups.'},
{svg:groups},
{h:'Parent and child groups'},
{code:`[web]
web1
web2

[db]
db1

[prod:children]
web
db`},
{p:'Targeting `prod` now reaches web1, web2 and db1, because child group members belong to the parent too.'},
{h:'Two automatic groups'},
{t:[['Group','Members'],
['`all`','Every host in the inventory'],
['`ungrouped`','Hosts that are in no other group (besides all)']]},
{h:'Group variables in the inventory file'},
{code:`[web:vars]
http_port=8080

[prod:vars]
env=production`},
{p:'Variables defined for a group apply to every member, including hosts inherited through child groups.'},
{h:'When a host is in several groups with the same variable'},
{ul:['A **child group** overrides its parent.','Between groups at the **same level**, the one loaded last (alphabetical order) wins. Set `ansible_group_priority` to control it.','A **host variable** always overrides a group variable.']},
{code:`# group_vars/prod.yml  - raise priority above other sibling groups
ansible_group_priority: 10`},
{h:'Design tip'},
{p:'Avoid putting the same variable in two sibling groups on purpose. If one host really belongs to both, make the rule explicit through priority or restructure the groups so each variable has one obvious home.'},
{note:'Group names should use letters, digits and underscores. Dashes still work in many places but trigger warnings and cannot be used in some contexts such as dotted variable access.'}],
src:[['Inventory groups',INV+'#inventory-basics-formats-hosts-and-groups'],['Inheriting variable values',INV+'#inheriting-variable-values-group-variables-for-groups-of-groups']]};

/* ---------- 2: group_vars / host_vars ---------- */
L['ansible:2:2']={blocks:[
{p:'Writing variables inside the inventory file gets messy quickly. The standard solution is two special directories, **group_vars** and **host_vars**, containing one YAML file per group or host. Ansible loads them automatically.'},
{svg:varLoad},
{h:'Layout'},
{code:`project/
  ansible.cfg
  inventory/
    hosts.yml
    group_vars/
      all.yml            # every host
      web.yml            # hosts in group web
      prod/              # a directory also works
        main.yml
        secrets.yml      # can be vault-encrypted
    host_vars/
      web1.yml           # only web1
  site.yml`},
{code:`# inventory/group_vars/web.yml
http_port: 8080
packages:
  - nginx
  - curl

# inventory/host_vars/web1.yml
http_port: 9090`},
{p:'On `web1`, `http_port` is `9090`: the host file beats the group file.'},
{h:'Where Ansible looks'},
{t:[['Location','Next to','Notes'],
['`group_vars/` and `host_vars/` beside the **inventory**','Inventory file or directory','Travels with the inventory; good for environment data'],
['`group_vars/` and `host_vars/` beside the **playbook**','The playbook being run','Loaded in addition; overrides the inventory-side values']]},
{h:'File naming rules'},
{ul:['A file can be `web.yml`, `web.yaml`, `web.json` or `web` with no extension.','A directory `web/` loads **all** files inside in lexical order, handy for splitting secrets from plain values.','`group_vars/all` applies to every host.']},
{h:'Practical advice'},
{flow:['Put environment facts (ports, URLs, sizes) in group_vars of that environment','Put one-off exceptions in host_vars','Keep secrets in a separate vault-encrypted file in the same directory','Use ansible-inventory --host to confirm the merged result']},
{note:'Precedence between all these places is covered in Section 6. For now remember: host beats group, child group beats parent, and `all` is the weakest.'}],
src:[['Organizing host and group variables',UG+'intro_inventory.html#organizing-host-and-group-variables'],['Variable precedence',UG+'playbooks_variables.html#variable-precedence-where-should-i-put-a-variable']]};

/* ---------- 3: Patterns ---------- */
L['ansible:2:3']={blocks:[
{p:'A **pattern** selects which hosts a play or command runs on. The same syntax is used in `hosts:`, in ad-hoc commands and in `--limit`. Mastering it prevents the most expensive mistake: running on the wrong machines.'},
{h:'Pattern syntax'},
{t:[['Pattern','Selects'],
['`all` or `*`','Every host'],
['`web1`','One host'],
['`web`','Group web'],
['`web:db`','Union: hosts in web **or** db'],
['`web:&prod`','Intersection: in web **and** prod'],
['`web:!web03`','Exclusion: web but not web03'],
['`web:db:&prod:!db2`','Combination of all the above'],
['`web*.example.com`','Wildcard on names'],
['`~web[0-9]+`','Regular expression (starts with ~)'],
['`web[0]`, `web[0:2]`','By position inside the group (first, first to third)']]},
{h:'Always preview'},
{code:`ansible 'web:&prod:!web03' --list-hosts
#   hosts (2):
#     web01
#     web02`},
{p:'`--list-hosts` prints the match without connecting. Make it a habit before any command that changes things.'},
{h:'--limit narrows a playbook'},
{code:`# playbook says: hosts: web
ansible-playbook site.yml --limit web01
ansible-playbook site.yml --limit 'web:&prod'
ansible-playbook site.yml --limit @failed_hosts.txt   # hosts listed in a file`},
{p:'`--limit` can only **reduce** the set the play already selected. It cannot add hosts.'},
{h:'Quoting'},
{p:'Patterns containing `!`, `&` or `*` should be put in single quotes. In bash an unquoted `!` can trigger history expansion, and `*` may be expanded by the shell.'},
{h:'Evaluation order'},
{flow:['Build the union of the plain groups and hosts','Keep only hosts present in every &-group','Remove hosts named with !','The result is the set the play runs on']},
{note:'Typos in group names produce a warning such as "Could not match supplied host pattern" and the play is skipped, not failed. Read the first lines of the output.'}],
src:[['Patterns: targeting hosts and groups',UG+'intro_patterns.html']]};

/* ---------- 4: ansible-inventory ---------- */
L['ansible:2:4']={blocks:[
{p:'`ansible-inventory` shows what Ansible actually sees after merging files, plugins and variable directories. It is the first tool to reach for when a host gets the wrong value.'},
{h:'Common commands'},
{t:[['Command','Result'],
['`ansible-inventory -i inv --list`','Full merged inventory as JSON'],
['`ansible-inventory -i inv --graph`','Tree of groups and hosts'],
['`ansible-inventory -i inv --graph --vars`','Tree including variables'],
['`ansible-inventory -i inv --host web1`','All variables for one host'],
['`ansible-inventory -i inv --list --yaml`','Merged inventory as YAML'],
['`ansible-inventory -i inv --list --export`','Output suitable to load into another inventory']]},
{h:'Graph view'},
{code:`ansible-inventory --graph
@all:
  |--@ungrouped:
  |--@prod:
  |  |--@web:
  |  |  |--web1
  |  |  |--web2
  |  |--@db:
  |  |  |--db1`},
{h:'Variables a host will receive'},
{code:`ansible-inventory --host web1
{
    "ansible_host": "10.0.0.11",
    "env": "production",
    "http_port": 9090,
    "packages": ["nginx", "curl"]
}`},
{p:'This view includes variables from inventory, `group_vars` and `host_vars`. It does **not** include facts, role defaults or play variables, because those do not exist until a play runs.'},
{h:'A debugging routine'},
{flow:['Host has an unexpected value','Run ansible-inventory --host name','Find where the value comes from (group_vars, host_vars, inventory file)','Check group membership with --graph','Fix the one source; run again']},
{note:'Use `ansible-inventory --list` in CI to fail the build if an inventory file cannot be parsed.'}],
src:[['ansible-inventory',K.CLI+'ansible-inventory.html']]};

/* ---------- 5: Dynamic inventory ---------- */
L['ansible:2:5']={blocks:[
{p:'In the cloud, hosts appear and disappear all the time, so a hand-written file goes stale. A **dynamic inventory** asks an API at run time. In current Ansible this is done with **inventory plugins**, which are configured by a small YAML file.'},
{svg:K.dg(700,170,[
[10,10,680,150,'Dynamic inventory',1],
[30,60,140,60,'Inventory plugin|aws_ec2.yml',2],[230,60,140,60,'Cloud API|EC2, Azure, VMware',0],[430,60,110,60,'Groups, hosts|and variables',2],[590,60,80,60,'Play runs',0]],
[[170,90,230,90],[370,90,430,90],[540,90,590,90]])},
{h:'Common inventory plugins'},
{t:[['Platform','Plugin (collection)','Python library'],
['AWS EC2','`amazon.aws.aws_ec2`','boto3, botocore'],
['Azure','`azure.azcollection.azure_rm`','azure SDK packages'],
['VMware vSphere','`community.vmware.vmware_vm_inventory`','pyvmomi'],
['Google Cloud','`google.cloud.gcp_compute`','google-auth, requests'],
['OpenStack','`openstack.cloud.openstack`','openstacksdk']]},
{h:'Example: AWS EC2'},
{code:`# aws_ec2.yml  (file name must end in aws_ec2.yml or aws_ec2.yaml)
plugin: amazon.aws.aws_ec2
regions:
  - eu-west-1
filters:
  tag:Environment: prod
  instance-state-name: running
keyed_groups:
  - key: tags.Role
    prefix: role
  - key: placement.availability_zone
    prefix: az
hostnames:
  - tag:Name
  - private-ip-address
compose:
  ansible_host: private_ip_address`},
{t:[['Key','Purpose'],
['`filters`','Server-side filter: only the instances you want'],
['`keyed_groups`','Create groups automatically from tags or attributes'],
['`hostnames`','Which attribute becomes the inventory name'],
['`compose`','Set variables with Jinja2 from instance attributes'],
['`groups`','Create groups with a Jinja2 condition']]},
{h:'Use it'},
{code:`pip install boto3 botocore
ansible-galaxy collection install amazon.aws

ansible-inventory -i aws_ec2.yml --graph
ansible -i aws_ec2.yml role_web -m ansible.builtin.ping`},
{h:'Authentication'},
{p:'Plugins use the normal credential chain of the cloud SDK: environment variables, profiles, or an instance role. Do not write keys into the YAML file.'},
{h:'Caching'},
{code:`plugin: amazon.aws.aws_ec2
cache: true
cache_plugin: jsonfile
cache_connection: /tmp/aws_inventory
cache_timeout: 600`},
{p:'Large accounts can make inventory calls slow. With caching, results are reused for `cache_timeout` seconds. Refresh on demand with `ansible-inventory --flush-cache`.'},
{note:'Mixing is fine: point `-i` at a directory containing a static file for fixed machines and a plugin file for cloud ones. Ansible merges them.'}],
src:[['Working with dynamic inventory',UG+'intro_dynamic_inventory.html'],['aws_ec2 plugin',D+'collections/amazon/aws/aws_ec2_inventory.html']]};

/* ---------- 6: Inventory design ---------- */
L['ansible:2:6']={blocks:[
{p:'An inventory is a safety mechanism as much as a data source. A good design makes the right target obvious and the wrong one hard to hit.'},
{svg:layout},
{h:'Principles'},
{t:[['Principle','What to do','Why'],
['**One inventory per environment**','Separate directories: dev, staging, prod','You cannot hit production by mistake with the dev inventory'],
['**Group by function and by environment**','`web`, `db`, `prod`, `staging`','Playbooks target function; variables come from environment'],
['**Consistent names**','`role-env-nn`, for example `web-prod-01`','Patterns and wildcards work predictably'],
['**Data in group_vars**','No host data in playbooks','Same playbook for every environment'],
['**Secrets separate**','Vault files next to group_vars','Safe to share and review the rest']]},
{h:'Layout example'},
{code:`inventories/
  dev/
    hosts.yml
    group_vars/all.yml
  prod/
    hosts.yml
    group_vars/
      all.yml
      web.yml
      db/
        vars.yml
        vault.yml
site.yml
ansible.cfg`},
{code:`ansible-playbook -i inventories/dev  site.yml
ansible-playbook -i inventories/prod site.yml --limit web-prod-01`},
{h:'Guard rails against accidental production runs'},
{ul:['Set the **default** inventory in `ansible.cfg` to dev or a lab, never to production.','Use a play-level safety check for prod, for example a `pause` prompt or an assert on a required variable.','Require `--limit` for production in team conventions and in the pipeline.','Run production only from a pipeline or AWX so there is a review and an audit trail.']},
{code:`- name: Safety check for production
  hosts: all
  gather_facts: false
  tasks:
    - name: Require explicit confirmation
      ansible.builtin.pause:
        prompt: "You are about to run on PRODUCTION. Press Enter to continue"
      when: env == "production"
      run_once: true`},
{note:'The same logic applies to dynamic inventories: filter by tag (Environment=prod) so the prod plugin file can only ever return production hosts.'}],
src:[['Best practices: inventory',UG+'sample_setup.html'],['Tips and tricks',UG+'playbooks_best_practices.html']]};
})();
