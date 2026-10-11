/* LearnSphere - Ansible, Section 10: Secrets, Security & Compliance.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG,VT=UG+'vault.html';

/* ---------- diagrams ---------- */
const vaultFlow=K.dg(700,180,[
[10,10,680,160,'Vault in the workflow',1],
[30,60,130,60,'secrets.yml|plain text',0],[200,60,130,60,'ansible-vault|encrypt',2],[370,60,130,60,'secrets.yml|AES256 in Git',2],[540,60,130,60,'Run: password|decrypts in memory',0]],
[[160,90,200,90],[330,90,370,90],[500,90,540,90]]);

const extFlow=K.dg(700,170,[
[10,10,680,150,'Secrets fetched at run time',1],
[30,60,140,60,'Playbook|lookup(...)',0],[230,60,150,60,'Secret store|Vault, AWS, Azure',2],[440,60,110,60,'Value in|memory only',0],[590,60,80,60,'Task|uses it',0]],
[[170,90,230,90],[380,90,440,90],[550,90,590,90]]);

const complianceFlow=K.dg(700,170,[
[10,10,680,150,'Compliance loop',1],
[30,60,120,60,'Benchmark|CIS, STIG',0],[190,60,120,60,'Scan|report gaps',2],[350,60,120,60,'Remediate|role with tags',2],[510,60,160,60,'Verify and keep|evidence',0]],
[[150,90,190,90],[310,90,350,90],[470,90,510,90]]);

/* ---------- 0: Vault ---------- */
L['ansible:9:0']={blocks:[
{p:'Passwords, tokens and keys will appear in your automation. **Ansible Vault** encrypts them (AES-256) so that they can live in Git next to the playbooks and still be safe. Vault is built in; no extra service is required.'},
{svg:vaultFlow},
{h:'Common commands'},
{code:`ansible-vault create group_vars/prod/vault.yml      # new encrypted file
ansible-vault encrypt group_vars/prod/secrets.yml   # encrypt an existing file
ansible-vault view group_vars/prod/vault.yml        # read without decrypting on disk
ansible-vault edit group_vars/prod/vault.yml        # edit in your editor
ansible-vault decrypt group_vars/prod/vault.yml     # make plain again (avoid)
ansible-vault rekey group_vars/prod/vault.yml       # change the password`},
{h:'Using a vaulted file'},
{code:`# group_vars/prod/vault.yml   (encrypted)
vault_db_password: "S0me-Long-Secret"
vault_api_token: "abc123"

# group_vars/prod/vars.yml    (plain, reviewed in pull requests)
db_password: "{{ vault_db_password }}"
api_token: "{{ vault_api_token }}"`},
{code:`ansible-playbook site.yml --ask-vault-pass
ansible-playbook site.yml --vault-password-file ~/.vault_pass`},
{p:'The **vault_ prefix pattern** keeps the plain file searchable: a reviewer can see which variable is used where, while only the values stay encrypted.'},
{h:'Encrypt a single value'},
{code:`ansible-vault encrypt_string 'S0me-Long-Secret' --name 'db_password'
# db_password: !vault |
#   $ANSIBLE_VAULT;1.1;AES256
#   6636...`},
{t:[['Approach','Good for','Drawback'],
['Whole encrypted file','Several secrets, easy to handle','Diffs show nothing about what changed'],
['`encrypt_string` inline','One secret next to plain values','Messy in large files']]},
{h:'Rekeying and offboarding'},
{flow:['A person with the vault password leaves the team','Run ansible-vault rekey on all vault files','Rotate the secrets themselves where they were exposed','Update the stored password in the CI or platform','Record the rotation']},
{note:'Vault protects secrets at rest in the repository. Anyone who can run the playbook can read the values at run time. Combine it with access control on who may run production.'}],
src:[['Protecting sensitive data with Ansible Vault',VT],['ansible-vault',K.CLI+'ansible-vault.html']]};

/* ---------- 1: Vault IDs ---------- */
L['ansible:9:1']={blocks:[
{p:'A single vault password for everything means that anyone able to decrypt development secrets can read production. **Vault IDs** label each encrypted item and let you use **different passwords** per environment.'},
{h:'Encrypt with a label'},
{code:`ansible-vault encrypt --vault-id dev@prompt  group_vars/dev/vault.yml
ansible-vault encrypt --vault-id prod@~/.vault_prod group_vars/prod/vault.yml`},
{p:'The label is stored in the file header: `$ANSIBLE_VAULT;1.2;AES256;prod`. Format 1.2 is the labelled format.'},
{h:'Run with several passwords'},
{code:`ansible-playbook site.yml \\
  --vault-id dev@~/.vault_dev \\
  --vault-id prod@prompt`},
{t:[['Source in `--vault-id label@source`','Meaning'],
['`prompt`','Ask interactively'],
['`path/to/file`','Read the password from a file'],
['`path/to/script`','Execute a script that prints the password (must be executable)']]},
{h:'Configuration'},
{code:`# ansible.cfg
[defaults]
vault_identity_list = dev@~/.vault_dev, prod@~/.vault_prod`},
{h:'Password scripts for automation'},
{p:'In CI, never commit a password file. Provide the secret through the pipeline secret store and use a small script to hand it to Ansible.'},
{code:`#!/bin/sh
# vault-client.sh  (chmod +x)
# the pipeline injects VAULT_PROD_PASSWORD as a masked variable
printf '%s' "$VAULT_PROD_PASSWORD"`},
{code:`ansible-playbook site.yml --vault-id prod@./vault-client.sh`},
{h:'Rules'},
{ul:['One vault ID per trust boundary (dev, staging, prod, team).','Password files live outside the repository, with mode 600, or in a secret manager.','Add password files to `.gitignore` and to secret-scanning rules.','Rotate with `rekey --new-vault-id` when membership changes.']},
{note:'Using labels does not change what is **secure**. The password you give for a label is what actually decrypts. Labels only help Ansible choose the right one and help you organise.'}],
src:[['Managing vault passwords',VT+'#managing-vault-passwords'],['Vault IDs',VT+'#vault-ids-and-passwords-for-multiple-environments']]};

/* ---------- 2: no_log ---------- */
L['ansible:9:2']={blocks:[
{p:'Encrypting a secret in the repository is only half the job. If the task prints it in the output, it ends up in terminals, CI logs and AWX job history. **no_log** hides task data from logs.'},
{code:`- name: Create the database user
  community.postgresql.postgresql_user:
    name: app
    password: "{{ db_password }}"
  no_log: true`},
{p:'With `no_log: true`, the task output shows only that it was censored, for both success and failure. That also hides useful error text, so use it on the specific tasks that handle secrets and not on whole plays.'},
{h:'Where secrets still leak'},
{t:[['Place','How it leaks','Fix'],
['`-vvv` and higher','Module arguments printed','`no_log: true` on the task'],
['`debug` of a variable','Prints the value on purpose','Do not debug secrets'],
['`--diff` output','Shows file content with secrets','`diff: false` on template tasks'],
['Registered result printed later','`debug: var=result` shows it','`no_log` on the registering task'],
['Command line of `command`','Visible in the process list','Pass secrets via files or environment, not arguments'],
['Callbacks and AWX job logs','Collected output','Same fixes, plus platform log access control'],
['Files on the managed node','Rendered templates contain secrets','Correct owner and mode, never world-readable']]},
{h:'Practical patterns'},
{code:`- name: Deploy a config that contains a password
  ansible.builtin.template:
    src: app.conf.j2
    dest: /etc/app/app.conf
    owner: app
    group: app
    mode: "0600"
  diff: false
  no_log: true

# toggle for troubleshooting only
- name: Create user (hide unless debugging)
  ansible.builtin.user:
    name: svc
    password: "{{ svc_hash }}"
  no_log: "{{ not (debug_secrets | default(false)) }}"`},
{h:'Global setting'},
{code:`# ansible.cfg
[defaults]
display_args_to_stdout = False`},
{note:'`no_log` hides output; it does not encrypt anything on disk or protect values passed to other systems. Combine it with strict file modes and vaulted sources.'}],
src:[['Logging Ansible output',D+'reference_appendices/logging.html'],['Keeping secret data (FAQ)',D+'reference_appendices/faq.html#how-do-i-keep-secret-data-in-my-playbook']]};

/* ---------- 3: SSH hardening, least privilege ---------- */
L['ansible:9:3']={blocks:[
{p:'The automation account is a powerful identity: it can log in everywhere and usually has root. If it is stolen, everything it manages is exposed. The goal is to make it **narrow, auditable and replaceable**.'},
{h:'Principles'},
{t:[['Principle','Practice'],
['**Separate identities**','One automation user and key per environment and per purpose; never share with humans'],
['**Least privilege**','Grant only the commands needed, not `ALL`, where practical'],
['**Short-lived credentials**','Rotate keys; consider SSH certificates with an expiry'],
['**Restrict origin**','Allow logins from the control node address only'],
['**Audit**','Central logs for authentication and sudo use']]},
{h:'Restrict where a key may be used'},
{code:`- name: Install the automation key, only from the control node
  ansible.posix.authorized_key:
    user: ansible
    key: "{{ lookup('ansible.builtin.file', 'keys/ansible.pub') }}"
    key_options: 'from="10.0.5.10",no-agent-forwarding,no-port-forwarding,no-X11-forwarding'
    exclusive: true`},
{h:'Limit what sudo can do'},
{code:`# /etc/sudoers.d/ansible-deploy  (validated with visudo -cf)
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart app, \\
                            /usr/bin/systemctl reload nginx`},
{p:'A wide `NOPASSWD:ALL` is simple but gives the account unlimited power. Narrow rules suit service accounts that run known deployment steps; full-root accounts are better kept behind an approval or a platform with auditing.'},
{h:'sshd settings for managed hosts'},
{t:[['Setting','Value','Why'],
['`PasswordAuthentication`','`no`','Keys only'],
['`PermitRootLogin`','`no` or `prohibit-password`','Use an unprivileged account and become'],
['`AllowUsers` / `AllowGroups`','Named accounts','Block unexpected logins'],
['`MaxAuthTries`','3 or 4','Slow brute force'],
['`ClientAliveInterval`','300','Drop dead sessions']]},
{h:'Bastions and jump hosts'},
{code:`# inventory group_vars/private.yml
ansible_ssh_common_args: "-o ProxyJump=ops@bastion.example.com"`},
{h:'Rotation routine'},
{flow:['Generate a new key pair','Add the new public key with authorized_key (not exclusive yet)','Switch automation to the new private key and test','Run authorized_key exclusive to remove the old key','Archive the audit record of the rotation']},
{note:'Keep the private key off laptops where possible. Run production automation from a hardened runner or a platform that stores credentials centrally.'}],
src:[['Connection details',UG+'connection_details.html'],['Privilege escalation',UG+'become.html']]};

/* ---------- 4: External stores ---------- */
L['ansible:9:4']={blocks:[
{p:'Vault keeps encrypted secrets in the repository. Many organisations prefer that secrets never live there at all, and are **retrieved at run time** from a central store with its own access control, rotation and audit log.'},
{svg:extFlow},
{h:'Common sources'},
{t:[['Store','Lookup plugin','Collection'],
['HashiCorp Vault','`community.hashi_vault.hashi_vault`','`community.hashi_vault`'],
['AWS Secrets Manager','`amazon.aws.secretsmanager_secret`','`amazon.aws`'],
['AWS SSM Parameter Store','`amazon.aws.ssm_parameter`','`amazon.aws`'],
['Azure Key Vault','`azure.azcollection.azure_keyvault_secret`','`azure.azcollection`'],
['1Password','`community.general.onepassword`','`community.general`']]},
{h:'HashiCorp Vault example'},
{code:`- name: Read a database password from HashiCorp Vault
  ansible.builtin.set_fact:
    db_password: >-
      {{ lookup('community.hashi_vault.hashi_vault',
                'secret=secret/data/app/db:password',
                url='https://vault.example.com:8200',
                auth_method='approle',
                role_id=vault_role_id,
                secret_id=vault_secret_id) }}
  no_log: true`},
{h:'AWS Secrets Manager example'},
{code:`- name: Read a secret
  ansible.builtin.set_fact:
    api_key: "{{ lookup('amazon.aws.secretsmanager_secret', 'prod/app/api_key', region='eu-west-1') }}"
  no_log: true`},
{h:'How access is authenticated'},
{ul:['**Cloud identity:** an instance role or workload identity, so no secret is needed to get a secret.','**AppRole / token** for HashiCorp Vault, supplied by the pipeline at run time.','**Short-lived** tokens that expire after the job.']},
{h:'Design notes'},
{t:[['Concern','Guidance'],
['Lookups run on the **control node**','The runner needs network and permission to the store'],
['Repeated lookups','Fetch once with `set_fact` or `run_once`, not per host and per loop item'],
['Failure behaviour','Fail the play if a secret cannot be retrieved; do not continue with an empty value'],
['Logging','Always add `no_log: true` to tasks that handle the value']]},
{note:'A secret store does not remove the bootstrap question: something must authenticate to it. Prefer platform identity or short-lived tokens injected by the pipeline over a long-lived password file.'}],
src:[['HashiCorp Vault collection','https://docs.ansible.com/ansible/latest/collections/community/hashi_vault/index.html'],['Lookup plugins',UG+'playbooks_lookups.html']]};

/* ---------- 5: Compliance ---------- */
L['ansible:9:5']={blocks:[
{p:'Many organisations must prove their systems follow a **benchmark**, such as the CIS Benchmarks or DISA STIGs. Ansible is well suited: the same code that applies a setting can later check it, and the output becomes **evidence**.'},
{svg:complianceFlow},
{h:'Benchmarks and tooling'},
{t:[['Item','What it is','Notes'],
['**CIS Benchmarks**','Consensus hardening guides per OS and product','Levels 1 (basic) and 2 (strict)'],
['**DISA STIG**','US government security guides','Used in regulated environments'],
['**OpenSCAP**','Scanner that evaluates a profile and creates reports','`oscap`, SCAP Security Guide content'],
['**ansible-lockdown**','Open-source roles implementing CIS and STIG controls','Variable and tag per control'],
['**RHEL system roles**','Supported roles for common configuration','Part of the Red Hat ecosystem']]},
{h:'Typical workflow'},
{flow:['Pick the benchmark and level for the system type','Scan to see the starting gap','Apply the role in check mode and review the diff','Apply in stages, with exceptions documented as variables','Re-scan and archive the report as evidence']},
{code:`# apply only a family of controls, skip a rule that breaks the application
ansible-playbook harden.yml --tags "ssh,auditd" --skip-tags "rule_1.1.1.1" --check --diff

# variables document accepted exceptions
rhel9cis_rule_5_2_4: false   # exception EX-142: legacy app needs this`},
{h:'Detecting drift'},
{code:`# scheduled run that must report zero changes
ansible-playbook baseline.yml --check --diff | tee drift-$(date +%F).log
# changed > 0 means someone altered a managed setting`},
{h:'Keeping it manageable'},
{ul:['**Do not apply a benchmark blindly.** Some controls break applications. Test on a copy first.','Treat exceptions as **data** with an owner and an expiry date.','Run compliance code from a pipeline or AWX so there is a record of each execution.','Keep scan output and playbook runs with timestamps for auditors.']},
{note:'Compliance is a continuous process, not a one-time project. A scheduled check-mode run that fails when drift appears is often the most valuable control.'}],
src:[['Ansible Lockdown','https://github.com/ansible-lockdown'],['OpenSCAP','https://www.open-scap.org/']]};

/* ---------- 6: Practical secure baseline ---------- */
L['ansible:9:6']={blocks:[
{p:'In this practical you combine what this section teaches into a **secure Linux baseline**: SSH, accounts, services and a firewall, applied by roles and then **proven** with a check run and verification tasks.'},
{h:'Baseline contents'},
{t:[['Area','Setting'],
['SSH','Keys only, no root login, limited attempts, approved users'],
['Accounts','Named admin group, no shared accounts, inactive users removed'],
['Services','Unneeded daemons stopped and disabled'],
['Firewall','Default deny; allow SSH and explicit service ports'],
['Logging','Auditing installed and enabled']]},
{h:'Playbook'},
{code:`# baseline.yml
- name: Secure Linux baseline
  hosts: all
  become: true
  vars:
    baseline_allowed_ports: [22]
    baseline_disabled_services: [telnet.socket, rsh.socket, cups]
  roles:
    - hardening            # ssh, sysctl, banner (Section 8)
  tasks:
    - name: Make sure the admin group exists
      ansible.builtin.group:
        name: admins

    - name: Gather service facts
      ansible.builtin.service_facts:

    - name: Disable unneeded services
      ansible.builtin.service:
        name: "{{ item }}"
        state: stopped
        enabled: false
      loop: "{{ baseline_disabled_services }}"
      when: item in ansible_facts.services

    - name: Install and enable auditd
      ansible.builtin.package:
        name: "{{ 'audit' if ansible_facts['os_family'] == 'RedHat' else 'auditd' }}"
        state: present

    - name: Allow only the approved ports (ufw)
      community.general.ufw:
        rule: allow
        port: "{{ item | string }}"
        proto: tcp
      loop: "{{ baseline_allowed_ports }}"
      when: ansible_facts['os_family'] == "Debian"

    - name: Enable ufw with a default deny policy
      community.general.ufw:
        state: enabled
        policy: deny
      when: ansible_facts['os_family'] == "Debian"`},
{h:'Prove it'},
{code:`# verify.yml - read-only checks that fail loudly
- name: Verify the baseline
  hosts: all
  become: true
  gather_facts: false
  tasks:
    - name: Read effective sshd settings
      ansible.builtin.command: sshd -T
      register: sshd_effective
      changed_when: false

    - name: Assert key SSH settings
      ansible.builtin.assert:
        that:
          - "'permitrootlogin no' in sshd_effective.stdout"
          - "'passwordauthentication no' in sshd_effective.stdout"
        fail_msg: "SSH is not hardened on {{ inventory_hostname }}"

    - name: Gather service facts
      ansible.builtin.service_facts:

    - name: Assert telnet is not running
      ansible.builtin.assert:
        that: "'telnet.socket' not in ansible_facts.services or ansible_facts.services['telnet.socket'].state != 'running'"`},
{h:'Sequence'},
{flow:['--check --diff on a lab host and review','Apply to the lab, keeping a session open','Run the same playbook again: expect changed=0','Run verify.yml: all assertions pass','Roll out in batches with serial']},
{h:'Evidence'},
{ul:['Archive the playbook run output (or AWX job) and the verify results with the date.','Store the Git commit of the baseline code that was applied.','Schedule `--check` runs to detect drift later.']},
{note:'If a hardening change locks you out, you lose the ability to fix it with Ansible. Always test on a disposable host first and keep out-of-band access (console) available for critical systems.'}],
src:[['service_facts',D+'collections/ansible/builtin/service_facts_module.html'],['assert',D+'collections/ansible/builtin/assert_module.html']]};
})();
