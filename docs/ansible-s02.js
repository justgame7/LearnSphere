/* LearnSphere - Ansible, Section 02: Installation & Lab Environment.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs ansible-common.js. */
(function(){
const K=window.AN,L=window.LESSONS,D=K.D,UG=K.UG;

/* ---------- diagrams ---------- */
const labTopo=K.dg(700,230,[
[10,10,680,210,'Three-node lab',1],
[40,70,170,80,'control|ansible-core, SSH key|user: ansible',2],
[330,45,160,60,'node1|web role|Python, sshd',0],[330,125,160,60,'node2|db role|Python, sshd',0],
[560,70,110,80,'Same private|network|192.168.56.0/24',0]],
[[210,100,330,75],[210,120,330,155],[490,75,560,95],[490,155,560,125]]);

const cfgOrder=K.dg(700,170,[
[10,10,680,150,'First file found wins (no merging)',1],
[30,60,140,60,'1. ANSIBLE_CONFIG|environment variable',0],[190,60,140,60,'2. ./ansible.cfg|current directory',2],[350,60,140,60,'3. ~/.ansible.cfg|home directory',0],[510,60,160,60,'4. /etc/ansible/|ansible.cfg',0]],
[[170,90,190,90],[330,90,350,90],[490,90,510,90]]);

/* ---------- 0: Install path ---------- */
L['ansible:1:0']={blocks:[
{p:'There are three common ways to get Ansible onto a control node. They differ in how current the version is, how isolated it is from the system and how much work the team has to do to keep everyone on the same version.'},
{h:'Compare the options'},
{t:[['Method','Version you get','Isolation','Best for'],
['**OS package** (`dnf`, `apt`)','Whatever the distribution ships; can be old','None, uses the system Python','Quick start on a server, locked-down environments'],
['**pip or pipx**','Latest, or any version you pin','Virtual environment, easy to keep several','Developers, CI, learning'],
['**Container / execution environment**','Pinned in the image','Complete: Python, collections and tools included','Teams, CI and AWX; identical runs everywhere']]},
{h:'How to choose'},
{flow:['Do you need a repeatable runtime shared by a team or CI?','Yes: build an execution environment container','No: do you need a recent or pinned version?','Yes: pip or pipx in a virtual environment','No: use the OS package']},
{h:'OS package'},
{code:`# RHEL, Rocky, Alma, Fedora
sudo dnf install ansible-core

# Ubuntu (community package, from the distribution or PPA)
sudo apt install ansible`},
{p:'Convenient, but you depend on the distribution release schedule and the package ties itself to the system Python.'},
{h:'pip or pipx'},
{code:`# pipx keeps each tool in its own virtual environment
pipx install --include-deps ansible

# or a project virtual environment
python3 -m venv .venv
. .venv/bin/activate
pip install ansible-core==2.17.*`},
{p:'Pinning in a `requirements.txt` file makes every developer and the pipeline run the same version.'},
{h:'Container / execution environment'},
{code:`# run a playbook inside an execution environment image
ansible-navigator run site.yml --execution-environment-image quay.io/ansible/creator-ee`},
{p:'The image carries ansible-core, collections and Python libraries. Section 13 covers building your own with `ansible-builder`.'},
{note:'For this course any of the three works. A virtual environment with pip is the recommended default because it is easy to recreate and version.'}],
src:[['Installing Ansible',K.INST+'intro_installation.html'],['ansible-navigator',K.NAV]]};

/* ---------- 1: Install on control node ---------- */
L['ansible:1:1']={blocks:[
{p:'This lecture installs ansible-core step by step and verifies it. The control node must be Linux or macOS. On Windows, use **WSL** with a Linux distribution; native Windows cannot be a control node.'},
{h:'Requirements'},
{ul:['A supported **Python 3** on the control node. Each ansible-core release lists its supported versions, and recent ones need Python 3.10 or newer.','**SSH client** and network reach to the managed nodes.','Python (a supported version) also on the managed nodes. Linux hosts only.']},
{h:'Linux (and WSL)'},
{code:`# Debian or Ubuntu: make sure venv support exists
sudo apt update
sudo apt install -y python3 python3-venv python3-pip sshpass

# create an isolated environment and install
python3 -m venv ~/venvs/ansible
. ~/venvs/ansible/bin/activate
pip install --upgrade pip
pip install ansible-core`},
{h:'macOS'},
{code:`# Homebrew installs the community package
brew install ansible

# or use pipx
brew install pipx
pipx install --include-deps ansible`},
{h:'Verify the install'},
{code:`ansible --version
# ansible [core 2.17.x]
#   config file = None
#   configured module search path = ['/home/user/.ansible/plugins/modules', ...]
#   ansible python module location = /home/user/venvs/ansible/lib/python3.12/site-packages/ansible
#   ansible collection location = /home/user/.ansible/collections:/usr/share/ansible/collections
#   executable location = /home/user/venvs/ansible/bin/ansible
#   python version = 3.12.3
#   jinja version = 3.1.4`},
{t:[['Line','What it tells you'],
['`ansible [core 2.x]`','The ansible-core version, which decides which features and modules exist'],
['`config file`','The ansible.cfg that is in effect (None means built-in defaults)'],
['`collection location`','Where collections are searched for'],
['`python version`','The Python that runs Ansible on the control node']]},
{h:'Shell completion'},
{code:`pip install argcomplete
activate-global-python-argcomplete --user
# open a new shell, then:  ansible-play<TAB>`},
{h:'Useful companion tools'},
{t:[['Command','Purpose'],
['`ansible`','Run one module on hosts (ad-hoc)'],
['`ansible-playbook`','Run playbooks'],
['`ansible-inventory`','Inspect inventory'],
['`ansible-config`','Show and validate configuration'],
['`ansible-doc`','Read module documentation offline'],
['`ansible-galaxy`','Install roles and collections'],
['`ansible-vault`','Encrypt secrets']]},
{note:'`sshpass` is only needed if you use password SSH logins. Key-based login is preferred and is what the next lecture sets up.'}],
src:[['Installing ansible-core',K.INST+'intro_installation.html'],['Control node requirements',K.INST+'installation_distros.html']]};

/* ---------- 2: Managed nodes ---------- */
L['ansible:1:2']={blocks:[
{p:'A managed node needs very little, but each item must be right. Most first-run failures come from SSH access, a missing interpreter or a user that cannot become root.'},
{h:'Checklist for a Linux managed node'},
{t:[['Requirement','Why','How to check'],
['**sshd** running and reachable','Ansible connects over SSH','`ssh user@host`'],
['**Python 3**','Modules are Python programs','`python3 --version` on the host'],
['**A service account**','A dedicated, auditable identity for automation','`id ansible`'],
['**Key-based login**','No passwords in files or scripts','`ssh -i key ansible@host`'],
['**sudo rights**','Most tasks need root','`sudo -n true`']]},
{h:'Create the automation user'},
{code:`# run once on each managed node, as root
useradd -m -s /bin/bash ansible
mkdir -p /home/ansible/.ssh
chmod 700 /home/ansible/.ssh`},
{h:'Create and distribute an SSH key'},
{code:`# on the control node
ssh-keygen -t ed25519 -f ~/.ssh/ansible_ed25519 -C "ansible automation"

# copy the public key to each managed node
ssh-copy-id -i ~/.ssh/ansible_ed25519.pub ansible@node1
ssh-copy-id -i ~/.ssh/ansible_ed25519.pub ansible@node2

# test
ssh -i ~/.ssh/ansible_ed25519 ansible@node1 hostname`},
{h:'Passwordless sudo, done safely'},
{p:'Unattended runs cannot type a sudo password. The safe way is a dedicated file in `/etc/sudoers.d/`, checked with `visudo` before it is activated. Never edit `/etc/sudoers` with a plain editor.'},
{code:`# on each managed node, as root
echo "ansible ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ansible
chmod 440 /etc/sudoers.d/ansible
visudo -cf /etc/sudoers.d/ansible     # must print: parsed OK`},
{flow:['Create the ansible user','Add the public key to authorized_keys','Grant sudo through a sudoers.d file','Verify with ssh and sudo -n true','Use the same account for all automation']},
{h:'Security notes'},
{ul:['`NOPASSWD:ALL` is convenient for a lab. In production limit commands or use an approval-based platform (Section 10).','Protect the **private key** with a passphrase and ssh-agent, or keep it in a secret store.','Use one automation account per environment so production keys are never on a laptop.']},
{note:'Python missing? Minimal images may lack it. The `raw` module can install it, which is covered in Section 4.'}],
src:[['Connection details',UG+'connection_details.html'],['Become',UG+'become.html']]};

/* ---------- 3: Safe lab ---------- */
L['ansible:1:3']={blocks:[
{p:'You learn Ansible by running it, and mistakes will happen. A lab keeps those mistakes away from real systems. There are three practical choices; any of them is fine.'},
{h:'Compare the lab options'},
{t:[['Option','Strengths','Watch out for','Cost'],
['**Containers** (Docker or Podman)','Starts in seconds, very light','No systemd by default, so service tasks need a special image','Free'],
['**Vagrant + VirtualBox**','Real VMs with full OS behaviour, reproducible from a file','Needs a few GB of RAM and disk','Free'],
['**Cloud VMs**','Closest to production, public IPs, many distros','Costs money; easy to forget running instances','Small hourly fee']]},
{h:'Recommended: three VMs with Vagrant'},
{code:`# Vagrantfile
Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-24.04"
  config.vm.provider "virtualbox" do |v|
    v.memory = 1024
    v.cpus = 1
  end
  (1..3).each do |i|
    config.vm.define "node#{i}" do |n|
      n.vm.hostname = "node#{i}"
      n.vm.network "private_network", ip: "192.168.56.1#{i}"
    end
  end
end`},
{code:`vagrant up           # create the machines
vagrant ssh node1    # log in
vagrant halt         # stop to save resources
vagrant destroy -f   # delete everything`},
{h:'Lightweight alternative: containers'},
{code:`# a throwaway Ubuntu with SSH, good enough for most file, user and package practice
docker run -d --name node1 -p 2201:22 \\
  -e SSH_ENABLE_ROOT=true rastasheep/ubuntu-sshd`},
{p:'Containers are excellent for modules such as `copy`, `template` and `user`, but they do not behave like a full host for services, firewalls or kernel settings.'},
{h:'Lab rules that save trouble'},
{ul:['**Never** point practice playbooks at a real inventory. Keep lab inventories in their own folder.','Name lab hosts clearly, for example `lab-node1`.','Snapshot or script the build so you can destroy and recreate in minutes.','In the cloud, set a **budget alert** and tag resources so cleanup is one command.','Destroy at the end of each session. A forgotten VM is the most common surprise bill.']},
{note:'A reproducible lab is itself a good habit: when something breaks you can delete it and start again instead of debugging a half-changed machine.'}],
src:[['Getting started',UG+'intro_getting_started.html'],['Vagrant documentation','https://developer.hashicorp.com/vagrant/docs']]};

/* ---------- 4: ansible.cfg ---------- */
L['ansible:1:4']={blocks:[
{p:'`ansible.cfg` holds defaults such as which inventory to use, which user to connect as and how many hosts to run in parallel. Knowing where Ansible looks for it prevents the classic problem of editing a file that is never used.'},
{svg:cfgOrder},
{h:'Search order'},
{ul:['The **first file found wins**; settings are not merged between files.','Environment variables such as `ANSIBLE_FORKS` override the file.','Command-line options override both.','A file in a **world-writable directory** is ignored for security reasons.']},
{h:'A practical project ansible.cfg'},
{code:`# ansible.cfg in the project root
[defaults]
inventory          = ./inventory
remote_user        = ansible
private_key_file   = ~/.ssh/ansible_ed25519
host_key_checking  = True
forks              = 10
interpreter_python = auto_silent
stdout_callback    = ansible.builtin.default
callback_result_format = yaml
retry_files_enabled = False

[privilege_escalation]
become             = False
become_method      = sudo
become_ask_pass    = False`},
{p:'Keeping `ansible.cfg` **inside the project** means everyone who clones the repository gets the same behaviour.'},
{h:'See the effective settings'},
{code:`ansible --version | head -3          # which config file is used
ansible-config dump --only-changed   # only settings that differ from defaults
ansible-config list                  # every setting with its description
ansible-config view                  # show the file in use`},
{t:[['Command','Use'],
['`ansible-config dump`','All settings with current value and where it came from'],
['`ansible-config dump --only-changed`','Quickest way to confirm your file is being read'],
['`ansible-config list`','Documentation of every option'],
['`ansible-config validate`','Check a configuration file for unknown options']]},
{h:'Precedence in one line'},
{flow:['Built-in defaults','ansible.cfg','Environment variables','Play and task keywords','Command-line options and extra-vars']},
{note:'`host_key_checking = False` is common in tutorials and a poor habit. Accept host keys once, or manage known_hosts, so you notice a man-in-the-middle or rebuilt host.'}],
src:[['Configuring Ansible',D+'reference_appendices/config.html'],['ansible-config',K.CLI+'ansible-config.html']]};

/* ---------- 5: First contact ---------- */
L['ansible:1:5']={blocks:[
{p:'The first real command is the `ping` module. It does not use ICMP. It logs in, runs a tiny Python program and expects the word **pong** back. A success proves SSH, authentication and Python are all working.'},
{code:`# inventory file (INI)
[lab]
node1 ansible_host=192.168.56.11
node2 ansible_host=192.168.56.12

# run
ansible lab -i inventory -m ansible.builtin.ping`},
{code:`node1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
node2 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}`},
{h:'Reading the output'},
{t:[['Part','Meaning'],
['`node1`','The inventory name of the host'],
['`SUCCESS`','Module ran. Other values: `CHANGED`, `FAILED!`, `UNREACHABLE!`'],
['`changed`','Whether the module changed something'],
['`ping`','The module return value'],
['`ansible_facts`','Appears for the setup module and holds gathered data']]},
{h:'Common first-run errors'},
{t:[['Message','Cause','Fix'],
['`UNREACHABLE! ... Connection timed out`','Wrong IP, firewall or sshd down','Test with plain `ssh`; check `ansible_host` and port'],
['`Permission denied (publickey,password)`','Key not accepted or wrong user','Check `remote_user`, the key path and `authorized_keys`'],
['`Host key verification failed`','New host key not in known_hosts','`ssh` once to accept it, or use `ssh-keyscan`'],
['`/bin/sh: 1: /usr/bin/python: not found`','No Python interpreter','Install python3, or set `ansible_python_interpreter`'],
['`Missing sudo password`','become is on but sudo asks for a password','Add NOPASSWD, or use `--ask-become-pass` (`-K`)']]},
{h:'A debugging order that works'},
{flow:['ssh user@host by hand: does it work?','ansible host -m ping -vvv','Read the first red line of the error','Fix SSH, Python or become','Run again']},
{note:'Add `-vvv` to see the exact SSH command Ansible used. Copy that command into a terminal to reproduce the problem in isolation.'}],
src:[['ping module',D+'collections/ansible/builtin/ping_module.html'],['Intro to ad-hoc commands',UG+'intro_adhoc.html']]};

/* ---------- 6: Practical lab ---------- */
L['ansible:1:6']={blocks:[
{p:'This practical builds the lab you will use for the rest of the course: one control node and two managed nodes. At the end you will have connectivity proven with `ping` and a fact-gathering run.'},
{svg:labTopo},
{h:'Step 1: create the project'},
{code:`mkdir -p ~/ansible-lab && cd ~/ansible-lab
git init`},
{h:'Step 2: inventory and configuration'},
{code:`# inventory
[web]
node1 ansible_host=192.168.56.11

[db]
node2 ansible_host=192.168.56.12

[lab:children]
web
db`},
{code:`# ansible.cfg
[defaults]
inventory         = ./inventory
remote_user       = ansible
private_key_file  = ~/.ssh/ansible_ed25519
host_key_checking = True
interpreter_python = auto_silent`},
{h:'Step 3: prepare access'},
{ul:['On each node: create the `ansible` user and install your public key (lecture 2 of this section).','Grant passwordless sudo with a `sudoers.d` file and check it with `visudo -cf`.','Connect once by hand so the host key is stored: `ssh ansible@192.168.56.11 true`.']},
{h:'Step 4: prove connectivity'},
{code:`ansible lab -m ansible.builtin.ping
ansible lab -m ansible.builtin.command -a "hostname"
ansible lab -b -m ansible.builtin.command -a "whoami"`},
{p:'The last command prints `root` because `-b` (become) switches to root via sudo.'},
{h:'Step 5: gather facts'},
{code:`ansible node1 -m ansible.builtin.setup -a "filter=ansible_distribution*"
# "ansible_distribution": "Ubuntu",
# "ansible_distribution_major_version": "24",
# "ansible_distribution_version": "24.04"`},
{h:'Checklist'},
{t:[['Check','Command','Expected'],
['Reachable','`ansible lab -m ping`','pong from both nodes'],
['Python found','`ansible lab -m setup -a gather_subset=min`','Facts returned'],
['Privilege escalation','`ansible lab -b -a whoami`','root'],
['Config in use','`ansible --version | grep config`','Path to your project ansible.cfg']]},
{note:'Commit the project now. From the next section on, every example in this course assumes this lab and this layout.'}],
src:[['Getting started',UG+'intro_getting_started.html'],['setup module',D+'collections/ansible/builtin/setup_module.html']]};
})();
