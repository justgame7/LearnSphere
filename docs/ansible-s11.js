/* LearnSphere - Ansible, Section 11: Real-World Automation Patterns.
   Lectures 0-7 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,CI=D+'collections/';

/* ---------- diagrams ---------- */
const release=K.dg(700,200,[
[10,10,680,180,'Release directories with an atomic switch',1],
[30,60,160,50,'releases/20261011-1',0],[30,125,160,50,'releases/20261012-1 (new)',2],
[260,80,140,50,'current (symlink)',2],[470,60,200,50,'shared/ config, uploads',0],[470,125,200,50,'Old releases kept for rollback',0]],
[[190,150,260,115],[190,85,260,100],[400,105,470,85]]);

const patchWaves=K.dg(700,200,[
[10,10,680,180,'Patching in waves',1],
[30,60,120,50,'Wave 1|canary, 1 host',2],[190,60,120,50,'Wave 2|25% of web',0],[350,60,120,50,'Wave 3|remaining web',0],[510,60,160,50,'Wave 4|databases, one at a time',0],
[30,130,640,40,'Each wave: pre-check, patch, reboot if needed, verify services, continue or stop',0]],
[[150,85,190,85],[310,85,350,85],[470,85,510,85]]);

const tfAnsible=K.dg(700,170,[
[10,10,680,150,'Terraform provisions, Ansible configures',1],
[30,55,130,60,'terraform apply|VMs, network, DNS',2],[210,55,140,60,'Outputs / state|IPs, tags',0],[400,55,130,60,'Inventory|built or dynamic',0],[580,55,90,60,'ansible-|playbook',2]],
[[160,85,210,85],[350,85,400,85],[530,85,580,85]]);

/* ---------- 0: Web and apps ---------- */
L['ansible:10:0']={blocks:[
{p:'A web tier is the classic Ansible workload: install a web server, manage certificates and virtual hosts, and deploy releases. The patterns below are the same for Nginx, Apache or an application behind them.'},
{h:'The building blocks'},
{t:[['Piece','Module or role','Notes'],
['Web server','`package`, `template`, `service`','Configuration from templates with `validate`'],
['Certificates','`community.crypto` modules, ACME, or a secret store','Never commit private keys unencrypted'],
['Virtual hosts','One template looped over a `sites` variable','Data-driven, not copied files'],
['Application','`unarchive`, `git`, `copy`, or container modules','Release directories and a symlink switch'],
['Health check','`uri` with `until`','Fail the deploy if the site is unhealthy']]},
{h:'Data-driven virtual hosts'},
{code:`# group_vars/web.yml
sites:
  - { name: shop.example.com, root: /var/www/shop, tls: true }
  - { name: blog.example.com, root: /var/www/blog, tls: false }`},
{code:`- name: Render one vhost per site
  ansible.builtin.template:
    src: vhost.conf.j2
    dest: "/etc/nginx/conf.d/{{ item.name }}.conf"
    mode: "0644"
  loop: "{{ sites }}"
  loop_control:
    label: "{{ item.name }}"
  notify: Reload nginx`},
{h:'TLS certificates'},
{code:`- name: Create a private key
  community.crypto.openssl_privatekey:
    path: /etc/ssl/private/shop.key
    size: 4096
    mode: "0600"

- name: Create a CSR
  community.crypto.openssl_csr:
    path: /etc/ssl/shop.csr
    privatekey_path: /etc/ssl/private/shop.key
    common_name: shop.example.com

- name: Self-signed certificate (lab only)
  community.crypto.x509_certificate:
    path: /etc/ssl/shop.crt
    csr_path: /etc/ssl/shop.csr
    privatekey_path: /etc/ssl/private/shop.key
    provider: selfsigned`},
{p:'In production use certificates from your CA or an ACME service (Let us Encrypt) with the `community.crypto.acme_certificate` modules or a certificate manager, and plan renewals.'},
{h:'Release directories'},
{svg:release},
{code:`- name: Create the new release directory
  ansible.builtin.file:
    path: "/opt/shop/releases/{{ release_id }}"
    state: directory

- name: Unpack the build
  ansible.builtin.unarchive:
    src: "shop-{{ release_id }}.tar.gz"
    dest: "/opt/shop/releases/{{ release_id }}"

- name: Switch the current symlink
  ansible.builtin.file:
    src: "/opt/shop/releases/{{ release_id }}"
    dest: /opt/shop/current
    state: link
  notify: Restart shop`},
{p:'The symlink switch is atomic, and the previous release stays on disk so that rollback is a single link change.'},
{note:'Clean old releases with a task that keeps the last few (use `find` with `age` or a sort), so disks do not fill silently.'}],
src:[['community.crypto',CI+'community/crypto/index.html'],['file module',D+'collections/ansible/builtin/file_module.html']]};

/* ---------- 1: Databases ---------- */
L['ansible:10:1']={blocks:[
{p:'Databases are stateful, so automation must be careful. Ansible is well suited to **installing and configuring** the server, **creating** databases and users and **scheduling** backups. Destructive changes need extra guard rails.'},
{h:'PostgreSQL basics'},
{code:`- name: Install PostgreSQL and the Python driver
  ansible.builtin.package:
    name: [postgresql-server, postgresql-contrib, python3-psycopg2]
    state: present

- name: Initialise the cluster (RHEL family)
  ansible.builtin.command: postgresql-setup --initdb
  args:
    creates: /var/lib/pgsql/data/PG_VERSION

- name: Configure client authentication
  ansible.builtin.template:
    src: pg_hba.conf.j2
    dest: /var/lib/pgsql/data/pg_hba.conf
    owner: postgres
    group: postgres
    mode: "0600"
  notify: Reload postgresql

- name: Start the service
  ansible.builtin.service:
    name: postgresql
    state: started
    enabled: true`},
{h:'Databases, users and privileges'},
{code:`- name: Create the application database
  community.postgresql.postgresql_db:
    name: shop
    encoding: UTF-8
  become: true
  become_user: postgres

- name: Create the application user
  community.postgresql.postgresql_user:
    db: shop
    name: shop_app
    password: "{{ vault_shop_db_password }}"
    role_attr_flags: NOSUPERUSER,NOCREATEDB
  become: true
  become_user: postgres
  no_log: true

- name: Grant privileges
  community.postgresql.postgresql_privs:
    db: shop
    role: shop_app
    objs: ALL_IN_SCHEMA
    type: table
    privs: SELECT,INSERT,UPDATE,DELETE
  become: true
  become_user: postgres`},
{h:'MySQL and MariaDB'},
{code:`- name: Create a database
  community.mysql.mysql_db:
    name: shop
    state: present

- name: Create a user
  community.mysql.mysql_user:
    name: shop_app
    password: "{{ vault_shop_db_password }}"
    priv: "shop.*:ALL"
    state: present
  no_log: true`},
{h:'Backups'},
{code:`- name: Nightly logical backup
  ansible.builtin.cron:
    name: shop pg_dump
    minute: "30"
    hour: "2"
    user: postgres
    job: 'pg_dump -Fc shop > /backup/shop-$(date +\\%F).dump'`},
{h:'Guard rails'},
{ul:['Run schema migrations with `run_once: true` and from a single known host.','Never automate `state: absent` for databases without an explicit confirmation variable.','Test restores, not only backups.','Keep passwords vaulted and use `no_log: true`.','Use `serial: 1` for rolling changes on replicated clusters.']},
{note:'For high availability, prefer proven tools (Patroni, managed cloud databases) and let Ansible install and configure them, rather than re-implementing failover in playbooks.'}],
src:[['community.postgresql',CI+'community/postgresql/index.html'],['community.mysql',CI+'community/mysql/index.html']]};

/* ---------- 2: Containers and Kubernetes ---------- */
L['ansible:10:2']={blocks:[
{p:'Ansible can run containers on a host and manage Kubernetes objects. It is good at **bootstrapping** and at glue work; for long-lived application delivery on Kubernetes, declarative tools usually fit better. Knowing the boundary is part of the skill.'},
{h:'Docker with community.docker'},
{code:`- name: Create a network
  community.docker.docker_network:
    name: appnet

- name: Pull the image
  community.docker.docker_image:
    name: nginx
    tag: "1.27"
    source: pull

- name: Run the container
  community.docker.docker_container:
    name: web
    image: nginx:1.27
    state: started
    restart_policy: unless-stopped
    published_ports:
      - "8080:80"
    networks:
      - name: appnet
    env:
      TZ: UTC`},
{t:[['Module','Purpose'],
['`docker_image`','Pull, build, push and remove images'],
['`docker_container`','Run and manage containers'],
['`docker_network`, `docker_volume`','Networks and volumes'],
['`docker_compose_v2`','Run a Compose project'],
['`docker_login`','Authenticate to a registry']]},
{h:'Kubernetes with kubernetes.core'},
{code:`- name: Create a namespace
  kubernetes.core.k8s:
    name: shop
    api_version: v1
    kind: Namespace
    state: present

- name: Apply a deployment from a template
  kubernetes.core.k8s:
    state: present
    template: deployment.yml.j2
    namespace: shop

- name: Install a Helm release
  kubernetes.core.helm:
    name: ingress
    chart_ref: ingress-nginx/ingress-nginx
    release_namespace: ingress
    create_namespace: true`},
{t:[['Module','Purpose'],
['`k8s`','Create, update and delete any object'],
['`k8s_info`','Read objects and wait for conditions'],
['`helm`, `helm_repository`','Charts and repositories'],
['`k8s_drain`, `k8s_scale`','Node and workload operations']]},
{p:'Requirements: the `kubernetes` Python library on the control node and a kubeconfig or in-cluster credentials.'},
{h:'Where Ansible fits'},
{t:[['Task','Better tool'],
['Install Docker or a container runtime on hosts','**Ansible**'],
['Bootstrap a cluster, configure nodes','**Ansible**'],
['Run a few containers on a VM','**Ansible**'],
['Continuous delivery of apps on Kubernetes','GitOps (Argo CD, Flux) or Helm in a pipeline'],
['Scaling and self-healing','Kubernetes itself'],
['Glue: create a namespace, secret or CRD during provisioning','**Ansible**']]},
{note:'Do not use Ansible to babysit containers in a cluster. The scheduler already does that continuously; Ansible runs only when invoked.'}],
src:[['community.docker',CI+'community/docker/index.html'],['kubernetes.core',CI+'kubernetes/core/index.html']]};

/* ---------- 3: Cloud ---------- */
L['ansible:10:3']={blocks:[
{p:'Ansible can create cloud resources through collections such as `amazon.aws`, `azure.azcollection` and `google.cloud`. The usual pattern is **provision**, then **hand the results to configuration plays** in the same run.'},
{h:'Provision on AWS'},
{code:`- name: Provision AWS resources
  hosts: localhost
  connection: local
  gather_facts: false
  vars:
    region: eu-west-1
  tasks:
    - name: Create a security group
      amazon.aws.ec2_security_group:
        name: web-sg
        description: Web servers
        region: "{{ region }}"
        rules:
          - { proto: tcp, ports: [22], cidr_ip: 10.0.0.0/8 }
          - { proto: tcp, ports: [80, 443], cidr_ip: 0.0.0.0/0 }
      register: sg

    - name: Launch instances
      amazon.aws.ec2_instance:
        name: "web-{{ item }}"
        region: "{{ region }}"
        instance_type: t3.micro
        image_id: "{{ ami_id }}"
        key_name: ops
        vpc_subnet_id: "{{ subnet_id }}"
        security_groups: ["{{ sg.group_id }}"]
        tags:
          Role: web
          Environment: staging
        wait: true
      loop: [1, 2]
      register: launched`},
{h:'Configure what you just created'},
{code:`    - name: Add new hosts to an in-memory group
      ansible.builtin.add_host:
        name: "{{ item.instances[0].private_ip_address }}"
        groups: new_web
        ansible_user: ec2-user
      loop: "{{ launched.results }}"

- name: Wait and configure
  hosts: new_web
  become: true
  gather_facts: false
  tasks:
    - name: Wait for SSH
      ansible.builtin.wait_for_connection:
        timeout: 300

    - name: Gather facts now
      ansible.builtin.setup:

    - name: Apply the web role
      ansible.builtin.include_role:
        name: webserver`},
{flow:['Play 1 on localhost: create network, security, instances','add_host builds a group from the results','Play 2 waits for SSH and gathers facts','Play 3 applies roles to the new hosts','Later runs use a dynamic inventory with tags']},
{h:'Other clouds'},
{t:[['Cloud','Typical modules'],
['AWS','`ec2_instance`, `ec2_vpc_net`, `s3_bucket`, `rds_instance`'],
['Azure','`azure_rm_virtualmachine`, `azure_rm_virtualnetwork`, `azure_rm_storageaccount`'],
['Google Cloud','`gcp_compute_instance`, `gcp_storage_bucket`']]},
{h:'Be realistic about state'},
{ul:['Ansible does not keep a **state file**. Idempotency comes from names and tags, so choose them carefully (`exact_count` or name filters).','Removing resources needs explicit tasks; there is no plan or diff of a whole environment.','For large or long-lived infrastructure, Terraform or a similar tool tracks relationships and deletes safely (see the Terraform and Ansible lecture later in this section).']},
{note:'Credentials: use environment variables, a profile or an instance role. Never put keys in the playbook, and use `no_log` on any task that handles them.'}],
src:[['amazon.aws',CI+'amazon/aws/index.html'],['add_host',D+'collections/ansible/builtin/add_host_module.html']]};

/* ---------- 4: Patching ---------- */
L['ansible:10:4']={blocks:[
{p:'Patching is a routine that must be safe, repeatable and reported. The risk is not applying updates, it is applying them to everything at once or rebooting at the wrong moment. Ansible gives you waves, health checks and a clear record.'},
{svg:patchWaves},
{h:'The playbook skeleton'},
{code:`- name: Patch web servers in waves
  hosts: web
  become: true
  serial:
    - 1
    - "25%"
    - "100%"
  max_fail_percentage: 10
  tasks:
    - name: Update all packages (RedHat family)
      ansible.builtin.dnf:
        name: "*"
        state: latest
      when: ansible_facts['os_family'] == "RedHat"

    - name: Update all packages (Debian family)
      ansible.builtin.apt:
        upgrade: dist
        update_cache: true
      when: ansible_facts['os_family'] == "Debian"

    - name: Is a reboot required (RedHat)?
      ansible.builtin.command: needs-restarting -r
      register: reboot_needed_rh
      changed_when: reboot_needed_rh.rc == 1
      failed_when: reboot_needed_rh.rc not in [0, 1]
      when: ansible_facts['os_family'] == "RedHat"

    - name: Is a reboot required (Debian)?
      ansible.builtin.stat:
        path: /var/run/reboot-required
      register: reboot_needed_deb
      when: ansible_facts['os_family'] == "Debian"

    - name: Reboot when needed
      ansible.builtin.reboot:
        reboot_timeout: 900
      when: >
        (reboot_needed_rh is defined and reboot_needed_rh.rc | default(0) == 1) or
        (reboot_needed_deb.stat.exists | default(false))

    - name: Verify the service after patching
      ansible.builtin.uri:
        url: http://localhost/health
        status_code: 200
      register: health
      until: health.status == 200
      retries: 10
      delay: 6`},
{h:'Safe routine'},
{flow:['Pre-checks: free disk, backups or snapshots, maintenance window','Drain the host from the load balancer','Patch and reboot only if required','Verify services and health','Return to service and move to the next wave']},
{h:'Design decisions'},
{t:[['Topic','Guidance'],
['Waves','Canary first; databases and primaries last and one at a time'],
['Kernel and critical packages','Consider pinning or excluding until tested'],
['Reboots','`ansible.builtin.reboot` waits for the host to return; set a realistic timeout'],
['Reporting','Use `package_facts` before and after, or a callback, to record what changed'],
['Windows','`ansible.windows.win_updates` with `win_reboot`']]},
{note:'Always know how to **roll back**: snapshots for VMs, a package version pin, or an image rebuild. "We will fix forward" is not a plan at 3am.'}],
src:[['reboot module',D+'collections/ansible/builtin/reboot_module.html'],['dnf module',D+'collections/ansible/builtin/dnf_module.html']]};

/* ---------- 5: Windows ---------- */
L['ansible:10:5']={blocks:[
{p:'Ansible manages Windows hosts agentlessly too, using **WinRM** (or OpenSSH) and PowerShell-based modules. The control node is still Linux or macOS. The `win_*` modules mirror the Linux ones: `win_copy`, `win_service`, `win_feature` and so on.'},
{h:'Connection options'},
{t:[['Connection','Notes'],
['**WinRM** over HTTPS (5986)','Traditional; transports: `ntlm`, `kerberos`, `credssp`, `basic`'],
['**OpenSSH** on Windows','Supported; useful when SSH is already standard']]},
{h:'Inventory'},
{code:`# group_vars/windows.yml
ansible_connection: winrm
ansible_port: 5986
ansible_winrm_transport: ntlm        # or kerberos in a domain
ansible_winrm_server_cert_validation: validate
ansible_user: svc_ansible
ansible_password: "{{ vault_win_password }}"`},
{h:'Prepare the host'},
{ul:['Enable a WinRM HTTPS listener with a valid certificate. For labs the `ConfigureRemotingForAnsible.ps1` script from the Ansible project does a quick setup.','Use an account with the rights you need. In domains prefer **Kerberos**.','Install `pywinrm` on the control node (`pip install pywinrm`).']},
{code:`ansible windows -m ansible.windows.win_ping`},
{h:'Modules you will use'},
{t:[['Task','Module'],
['Windows features and roles','`ansible.windows.win_feature`'],
['Packages (Chocolatey)','`chocolatey.chocolatey.win_chocolatey`'],
['MSI or EXE installers','`ansible.windows.win_package`'],
['Services','`ansible.windows.win_service`'],
['Files and templates','`win_copy`, `win_template`, `win_file`'],
['Registry','`ansible.windows.win_regedit`'],
['Firewall','`community.windows.win_firewall_rule`'],
['Updates and reboot','`ansible.windows.win_updates`, `win_reboot`'],
['Commands','`win_command`, `win_shell` (last resort, like `shell`)']]},
{code:`- name: Windows web server
  hosts: windows
  tasks:
    - name: Install IIS
      ansible.windows.win_feature:
        name: Web-Server
        state: present
        include_management_tools: true
      register: iis

    - name: Reboot if IIS asks for it
      ansible.windows.win_reboot:
      when: iis.reboot_required

    - name: Install a tool with Chocolatey
      chocolatey.chocolatey.win_chocolatey:
        name: 7zip
        state: present

    - name: Start the service
      ansible.windows.win_service:
        name: W3SVC
        state: started
        start_mode: auto`},
{h:'Differences to remember'},
{ul:['Paths use backslashes; in YAML double-quoted strings write `\\\\` or use single quotes.','Privilege escalation uses `become_method: runas`.','`win_shell` and `win_command` are not idempotent unless you add `creates` or `changed_when`.','Double hop (reaching a network share from a remote session) needs CredSSP, Kerberos delegation or `become`.']},
{note:'Collections to install: `ansible.windows`, `community.windows` and `chocolatey.chocolatey`. They are included in the `ansible` community package.'}],
src:[['Windows support',UG+'windows.html'],['ansible.windows',CI+'ansible/windows/index.html']]};

/* ---------- 6: Network ---------- */
L['ansible:10:6']={blocks:[
{p:'Network devices usually cannot run Python, so Ansible works differently: tasks run **on the control node** and talk to the device over SSH CLI or an API through a **network connection plugin**. Vendor collections provide the modules.'},
{h:'Connection and inventory'},
{code:`# group_vars/ios.yml
ansible_connection: ansible.netcommon.network_cli
ansible_network_os: cisco.ios.ios
ansible_user: netops
ansible_password: "{{ vault_net_password }}"
ansible_become: true
ansible_become_method: enable
ansible_command_timeout: 60`},
{h:'Collections per platform'},
{t:[['Platform','Collection','`ansible_network_os`'],
['Cisco IOS / IOS XE','`cisco.ios`','`cisco.ios.ios`'],
['Cisco NX-OS','`cisco.nxos`','`cisco.nxos.nxos`'],
['Arista EOS','`arista.eos`','`arista.eos.eos`'],
['Juniper Junos','`junipernetworks.junos`','`junipernetworks.junos.junos`'],
['VyOS','`vyos.vyos`','`vyos.vyos.vyos`']]},
{h:'Read, back up, change'},
{code:`- name: Network baseline
  hosts: ios
  gather_facts: false
  tasks:
    - name: Collect facts
      cisco.ios.ios_facts:
        gather_subset: min

    - name: Run a show command
      cisco.ios.ios_command:
        commands: show version
      register: version

    - name: Back up the running configuration
      cisco.ios.ios_config:
        backup: true
        backup_options:
          dir_path: backups
          filename: "{{ inventory_hostname }}.cfg"

    - name: Push NTP configuration
      cisco.ios.ios_config:
        lines:
          - ntp server 10.0.0.10
          - ntp server 10.0.0.11
        save_when: modified`},
{h:'Resource modules'},
{p:'Resource modules describe a **section** of configuration as structured data, so the module can compare, diff and be idempotent on structure, not on text lines.'},
{code:`- name: Make VLANs match the data
  cisco.ios.ios_vlans:
    config:
      - { vlan_id: 10, name: users }
      - { vlan_id: 20, name: servers }
    state: replaced`},
{t:[['state','Meaning'],
['`merged`','Add or update only what is given'],
['`replaced`','Replace the given sections, leave the rest'],
['`overridden`','Make the device exactly match, remove everything else'],
['`deleted`','Remove the given items'],
['`gathered`','Read current configuration as structured data']]},
{h:'Safe practice'},
{flow:['Gather and back up the current configuration','Run in check mode with diff to see the change','Apply to a lab or one device','Verify with show commands or resource gathered state','Roll out in small groups, commit to Git']},
{note:'Prefer resource modules over `ios_config` with raw lines whenever one exists, and use `overridden` only with great care.'}],
src:[['Network automation',UG+'network/index.html'],['cisco.ios',CI+'cisco/ios/index.html']]};

/* ---------- 7: Terraform + Ansible ---------- */
L['ansible:10:7']={blocks:[
{p:'In many organisations the cleanest design is: **Terraform** creates and tracks the infrastructure, **Ansible** configures what runs on it. The skill is in the hand-off: how Ansible learns which hosts exist.'},
{svg:tfAnsible},
{h:'Responsibilities'},
{t:[['Concern','Terraform','Ansible'],
['Networks, VMs, load balancers, DNS','**Owns**','Avoid'],
['State and drift of cloud resources','**Owns** (state file)','Not tracked'],
['OS packages, config files, services','Avoid','**Owns**'],
['Application deploys and operations','Possible, but limited','**Owns**'],
['Ordering of multi-step runbooks','Limited','**Owns**']]},
{h:'Hand-off pattern 1: dynamic inventory by tags'},
{p:'Terraform tags every instance (`Role`, `Environment`). Ansible uses a cloud inventory plugin to find them. There is no direct coupling.'},
{code:`# in Terraform
tags = { Role = "web", Environment = "prod" }

# in Ansible
ansible-inventory -i aws_ec2.yml --graph      # groups like role_web`},
{h:'Hand-off pattern 2: generate an inventory from outputs'},
{code:`# terraform
output "web_ips" { value = aws_instance.web[*].private_ip }

# shell step in the pipeline
terraform output -json web_ips | jq -r '.[]' | sed 's/^/web /' > inventory/generated`},
{h:'Hand-off pattern 3: use Terraform state as inventory'},
{code:`# inventory/terraform.yml
plugin: cloud.terraform.terraform_state
backend_type: s3
backend_config:
  bucket: my-tf-state
  key: prod/terraform.tfstate
  region: eu-west-1`},
{p:'The `cloud.terraform` collection can also **run** Terraform from a playbook (`cloud.terraform.terraform` module) when you want one entry point.'},
{h:'Pipeline order'},
{flow:['terraform plan and apply (reviewed)','Pipeline extracts outputs or refreshes inventory','ansible-playbook waits for SSH and configures','Verification tests run','Both stages are tagged with the same release']},
{h:'Pitfalls'},
{ul:['Avoid Terraform `local-exec` provisioners that run Ansible: failures are hidden inside apply and re-runs are awkward.','New instances may not accept SSH immediately; use `wait_for_connection`.','Do not let both tools manage the same attribute (for example security group rules).','Keep Terraform state access limited; it often contains secrets.']},
{note:'Agree the interface between the two: tag names, output names and who is allowed to change what. That contract is more important than the glue script.'}],
src:[['cloud.terraform collection',CI+'cloud/terraform/index.html'],['Terraform and Ansible (HashiCorp)','https://developer.hashicorp.com/terraform/intro']]};
})();
