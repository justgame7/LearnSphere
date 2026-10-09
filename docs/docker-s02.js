/* LearnSphere - Docker, Section 02: Installation & Daemon Configuration.
   Lectures 0-6 are core, 7-12 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;

/* ---------- diagrams ---------- */
const remote=K.dg(700,200,[
[10,60,160,70,'Your laptop|docker CLI|context: prod',0],
[250,60,150,70,'SSH tunnel|(encrypted, key login)',2],
[480,20,210,160,'Remote Linux server',1],
[500,60,170,60,'dockerd|(unix socket)',2],[500,130,170,40,'Containers run here',0]],
[[170,95,250,95],[400,95,500,95]]);

const dec=K.dg(700,230,[
[10,90,150,56,'Where will Docker run?',2],
[230,15,200,50,'Linux server / CI / VM|production',0],[230,90,200,56,'Windows or macOS|developer laptop',0],[230,170,200,50,'Linux desktop|developer',0],
[510,15,180,50,'Docker Engine (repository)',2],[510,90,180,56,'Docker Desktop|(WSL 2 / VM inside)',2],[510,170,180,50,'Engine or Desktop',2]],
[[160,105,230,40],[160,118,230,118],[160,130,230,190],[430,40,510,40],[430,118,510,118],[430,195,510,195]]);

/* ---------- 0: Choosing an install path ---------- */
L['docker:1:0']={blocks:[
{p:'Before typing any install command, decide **where Docker will run**. The answer picks the product, and the product decides networking, file sharing and performance.'},
{svg:dec},
{h:'The two main paths'},
{t:[['','Docker Engine','Docker Desktop'],
['What you get','Daemon, CLI, containerd, buildx, compose plugin','Engine + GUI + Linux VM + Compose + Scout + extras'],
['Runs on','Linux (kernel features used directly)','Windows, macOS, Linux (always inside its own VM)'],
['Interface','Command line','Command line + dashboard'],
['Performance','Native','Good; bind mounts across the VM are slower'],
['Licensing','Open source','Free for individuals and small businesses; paid for larger companies'],
['Best for','Servers, CI, production','Developer workstations']]},
{h:'What each path means in practice'},
{ul:['**Networking:** On Engine, published ports are on the host. On Desktop, ports are forwarded from the VM to `localhost`. Containers cannot be reached directly by IP from the host on Desktop.','**File sharing:** Bind-mounting a project folder on Desktop passes through the VM (WSL 2 on Windows is fast when files live **inside** the WSL file system).','**Resources:** Engine uses the whole host. Desktop uses only the CPU, memory and disk you allow in its settings.','**Consistency:** The same Dockerfile and image work on both. Only the host plumbing differs.']},
{h:'Windows users: three layouts'},
{t:[['Layout','Description','When to choose'],
['Docker Desktop with the WSL 2 backend','Desktop runs Engine in a WSL 2 distribution','Most Windows developers'],
['Engine inside a WSL 2 Linux distro','You install Engine like on any Linux box','You want Engine behaviour without Desktop'],
['A Linux VM (Hyper-V, VirtualBox, cloud)','A full separate Linux server','You need a production-like lab']]},
{note:'Windows containers (running Windows programs in containers) exist but are a separate mode and are outside this course. Everything here uses Linux containers.'},
{h:'Supported Linux platforms'},
{p:'Docker publishes repository packages for the mainstream distributions: Ubuntu, Debian, Fedora, CentOS Stream, RHEL and others, on common CPU architectures (x86-64, ARM64). Always check the **supported platforms** page for your exact release, because supported versions change.'},
{h:'Quick decision checklist'},
{ul:['Production or CI on Linux: **Engine from the Docker repository**.','Laptop on Windows or macOS: **Docker Desktop**.','Need an air-gapped or minimal install: static binaries (Additional content).','Cannot give the daemon root: rootless mode (Additional content).']}],
src:[['Install Docker Engine',E+'install/'],['Install Docker Desktop',K.D+'desktop/setup/install/windows-install/'],['Docker Engine on WSL 2',K.D+'desktop/features/wsl/']]};

/* ---------- 1: Installing Engine from repositories ---------- */
L['docker:1:1']={blocks:[
{p:'The recommended way to install Docker Engine on a Linux server is from **Docker official package repository**. You get updates through the normal package manager, and the packages are signed.'},
{h:'What gets installed'},
{t:[['Package','What it is'],
['`docker-ce`','The Docker Engine daemon (dockerd)'],
['`docker-ce-cli`','The `docker` command'],
['`containerd.io`','The container runtime manager'],
['`docker-buildx-plugin`','`docker buildx` for BuildKit builds'],
['`docker-compose-plugin`','`docker compose` (version 2)'],
['`docker-ce-rootless-extras`','Optional: rootless mode helpers']]},
{h:'Plan'},
{flow:['Remove conflicting old packages','Add the Docker GPG key and the repository','Install the packages','Start the service and verify']},
{h:'Ubuntu and Debian (apt)'},
{p:'Replace `ubuntu` with `debian` in the URLs on Debian. If your distribution is a derivative (for example Linux Mint), use its base release codename.'},
{code:`# 1. Remove old or unofficial packages (safe if none exist)
for p in docker.io docker-doc docker-compose podman-docker containerd runc; do sudo apt-get remove -y $p; done

# 2. Add Docker official GPG key
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 3. Add the repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Install
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`},
{note:'Docker documentation may show a newer repository file format (a .sources file). Both work; follow the current page for your distribution.'},
{h:'Fedora and CentOS Stream (dnf)'},
{code:`sudo dnf -y install dnf-plugins-core
# Fedora (use .../linux/centos/docker-ce.repo for CentOS Stream, .../linux/rhel/... for RHEL)
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
# On newer dnf5 the syntax is: sudo dnf config-manager addrepo --from-repofile=URL

sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker`},
{p:'On Debian-family systems the service starts automatically after install. On RPM-family systems you must start it yourself (the last line above).'},
{h:'Verify'},
{code:`sudo docker version
sudo docker run --rm hello-world
sudo docker compose version
sudo docker buildx version`},
{h:'Pin a specific version'},
{p:'In production you usually want a **known version**, not "whatever is newest today".'},
{code:`# Ubuntu / Debian: list available versions, then install one
apt-cache madison docker-ce | awk '{print $3}' | head
VERSION_STRING=5:28.0.1-1~ubuntu.24.04~noble      # example; copy from the list
sudo apt-get install -y docker-ce=$VERSION_STRING docker-ce-cli=$VERSION_STRING containerd.io docker-buildx-plugin docker-compose-plugin

# Stop apt from upgrading it by accident
sudo apt-mark hold docker-ce docker-ce-cli

# Fedora / CentOS
dnf list docker-ce --showduplicates | sort -r
sudo dnf install docker-ce-3:28.0.1-1.fc41 docker-ce-cli-1:28.0.1-1.fc41 containerd.io`},
{h:'The convenience script (for labs only)'},
{code:`curl -fsSL https://get.docker.com -o get-docker.sh
less get-docker.sh                 # always read a script before running it
sudo sh get-docker.sh --dry-run    # shows what it would do`},
{ul:['It detects your distribution and installs the latest stable Engine.','It is **not recommended for production**: it does not pin versions and it installs what the script decides.']},
{h:'Common problems'},
{t:[['Symptom','Likely cause and fix'],
['`Cannot connect to the Docker daemon`','Service not running: `sudo systemctl start docker`'],
['`permission denied ... docker.sock`','Not root and not in the docker group (next lecture)'],
['`Package docker-ce has no installation candidate`','Repository not added or wrong release codename'],
['Conflict with `containerd` or `docker.io`','Remove old packages first (step 1)']]}],
src:[['Install on Ubuntu',E+'install/ubuntu/'],['Install on Debian',E+'install/debian/'],['Install on Fedora',E+'install/fedora/'],['Install on CentOS',E+'install/centos/']]};

/* ---------- 2: Post-install steps ---------- */
L['docker:1:2']={blocks:[
{p:'After installing Engine there are three small jobs: make it **start on boot**, decide **who may run docker without sudo**, and **verify** the installation.'},
{h:'1. Start on boot with systemd'},
{code:`sudo systemctl enable --now docker.service containerd.service
systemctl status docker --no-pager
systemctl is-enabled docker          # prints: enabled`},
{p:'`enable` makes it start at every boot. `--now` also starts it immediately. To turn off boot start use `sudo systemctl disable docker docker.socket`.'},
{h:'2. Run docker without sudo: the docker group'},
{p:'The daemon socket is owned by root and group `docker`. Members of that group can use Docker without `sudo`.'},
{code:`sudo groupadd docker 2>/dev/null || true     # usually already exists
sudo usermod -aG docker $USER                 # add yourself
newgrp docker                                 # or log out and in again
docker run --rm hello-world                   # no sudo needed now
id                                            # docker should appear in your groups`},
{note:'**Security trade-off:** a member of the docker group can start a container that mounts the host root filesystem, so the group is **equivalent to root** on that host. Add only trusted users. For stronger separation use rootless mode.'},
{h:'3. Verify with hello-world'},
{p:'`hello-world` is a tiny image that proves the whole chain works. When you run it, this happens:'},
{flow:['The CLI asks the daemon to run hello-world','The image is not local, so the daemon pulls it from Docker Hub','The daemon creates a container from it and starts the program','The program prints a message and exits','The output is streamed back to your terminal']},
{code:`docker run hello-world
# Unable to find image 'hello-world:latest' locally
# latest: Pulling from library/hello-world
# Hello from Docker!
# This message shows that your installation appears to be working correctly.

docker ps -a        # the finished container is listed (status: Exited)
docker rm $(docker ps -aq --filter ancestor=hello-world)`},
{h:'Check the details'},
{t:[['Command','What it tells you'],
['`docker version`','Client and server versions and API versions'],
['`docker info`','Storage driver, cgroup version, root directory, runtimes, containers and images count, warnings'],
['`docker context ls`','Which daemon the CLI is pointed at'],
['`docker system df`','Disk used by images, containers and volumes'],
['`systemctl status docker`','Is the service running?'],
['`journalctl -u docker -n 50`','Recent daemon logs']]},
{p:'`docker info` is worth reading once. Look at **Server Version**, **Storage Driver** (usually overlay2), **Cgroup Version** (2 on modern systems), **Docker Root Dir** (`/var/lib/docker`) and the **Warnings** at the bottom.'},
{h:'Troubleshooting checklist'},
{ul:['`Cannot connect to the Docker daemon` → the service is stopped (`systemctl start docker`) or your CLI context points elsewhere (`docker context ls`).','`permission denied` on the socket → you are not in the docker group, or the new group has not applied yet (log out and back in).','`Got permission denied` right after `usermod` → run `newgrp docker` or start a new login session.','hello-world hangs on pull → check internet, DNS or a proxy (proxy settings come later in the course).']}],
src:[['Linux post-installation steps',E+'install/linux-postinstall/'],['Docker Engine: docker info',R+'cli/docker/system/info/']]};

/* ---------- 3: Docker Desktop ---------- */
L['docker:1:3']={blocks:[
{p:'**Docker Desktop** is the easiest way to get a complete Docker environment on a workstation. It installs like any normal application.'},
{h:'Requirements at a glance'},
{t:[['System','What you need'],
['**Windows**','64-bit Windows 10 or 11 with virtualization enabled in BIOS/UEFI. The **WSL 2** backend is recommended; Hyper-V is another option on some editions.'],
['**macOS**','A supported recent macOS on Apple silicon or Intel. Apple silicon runs Linux containers natively; Intel images may need emulation.'],
['**Linux**','A supported 64-bit distribution with KVM virtualization and systemd. Desktop runs its **own VM**, separate from any Docker Engine on the host.']]},
{p:'Exact supported OS versions and minimum RAM change with releases. Read the **system requirements** page of the installer you download.'},
{h:'Windows: install with WSL 2'},
{flow:['Turn on virtualization in the firmware if needed','Install WSL 2 (wsl --install in an administrator terminal), then restart','Download Docker Desktop Installer and run it; keep "Use WSL 2" ticked','Start Docker Desktop and accept the subscription terms','Open a terminal and run docker version and docker run hello-world']},
{code:`wsl --install                  # installs WSL 2 and a default Ubuntu (administrator PowerShell)
wsl --status
wsl -l -v                      # distros and which WSL version each uses

docker version
docker run --rm hello-world`},
{h:'macOS'},
{ul:['Download the right installer (Apple silicon or Intel), drag Docker to Applications, start it.','On first start Desktop asks for permission to install the networking helper.','Pick resources in **Settings > Resources**.']},
{h:'Linux'},
{code:`# Debian/Ubuntu example (download the .deb from the Docker site first)
sudo apt-get update
sudo apt-get install ./docker-desktop-amd64.deb
systemctl --user start docker-desktop

docker context ls              # you will see a desktop-linux context`},
{note:'On Linux, Desktop and a system Docker Engine can both exist. They are **different daemons** with different images and containers. `docker context use` chooses which one the CLI talks to.'},
{h:'What the installer gives you'},
{svg:K.dg(700,220,[
[10,10,680,200,'Docker Desktop',1],
[30,45,200,52,'GUI dashboard',0],[250,45,200,52,'Docker CLI + Compose + buildx',0],[470,45,200,52,'Scout, extensions, Model Runner',0],
[30,120,640,70,'Lightweight Linux VM (WSL 2 or hypervisor)|Docker Engine + containerd run here',2]],
[[130,97,130,120],[350,97,350,120],[570,97,570,120]])},
{h:'Do I need to sign in?'},
{p:'You can use Docker locally without an account in many setups, but signing in raises Docker Hub pull limits and unlocks Scout and other features. Corporate machines often enforce sign-in. Check your organisation policy.'},
{h:'First checks'},
{code:`docker version
docker info | head -20
docker run --rm -p 8080:80 nginx        # open http://localhost:8080
# press Ctrl+C to stop, then:
docker context ls`},
{h:'Typical problems'},
{ul:['**"Docker Desktop starting..." forever** → virtualization disabled or WSL 2 not installed; check WSL status.','**Slow bind mounts on Windows** → keep project files **inside** the WSL Linux file system, not under /mnt/c.','**Port already in use** → another program holds the port; choose a different host port.','**Out of disk or memory** → change the limits in Settings > Resources or prune unused data.']}],
src:[['Docker Desktop for Windows',K.D+'desktop/setup/install/windows-install/'],['Docker Desktop for Mac',K.D+'desktop/setup/install/mac-install/'],['Docker Desktop for Linux',K.D+'desktop/setup/install/linux/']]};

/* ---------- 4: daemon.json ---------- */
L['docker:1:4']={blocks:[
{p:'The Docker daemon is configured with a single JSON file, **daemon.json**. You edit it to change things such as where Docker stores data, the default log driver, DNS servers and the IP ranges Docker uses for networks.'},
{h:'Where the file lives'},
{t:[['Platform','Path'],
['Linux (Engine)','`/etc/docker/daemon.json`'],
['Linux, rootless mode','`~/.config/docker/daemon.json`'],
['Windows (Windows containers)','`C:\\ProgramData\\docker\\config\\daemon.json`'],
['Docker Desktop','Settings > Docker Engine (an editor for the same JSON)']]},
{p:'The file does not exist by default. Create it. If it is missing, Docker uses built-in defaults.'},
{h:'Frequently used settings'},
{t:[['Key','What it does','Example'],
['`data-root`','Where images, containers and volumes are stored','`"/data/docker"`'],
['`log-driver` / `log-opts`','Default logging and rotation','`"local"`, `{"max-size":"10m","max-file":"3"}`'],
['`dns`','DNS servers given to containers','`["10.0.0.2","8.8.8.8"]`'],
['`default-address-pools`','IP ranges for new bridge networks','`[{"base":"10.200.0.0/16","size":24}]`'],
['`bip`','Address and subnet of the default `docker0` bridge','`"172.30.0.1/24"`'],
['`registry-mirrors`','Pull-through mirrors for Docker Hub','`["https://mirror.example.com"]`'],
['`insecure-registries`','Registries allowed without TLS (lab only)','`["registry.lan:5000"]`'],
['`live-restore`','Keep containers running when dockerd restarts','`true`'],
['`storage-driver`','Layer driver (normally leave default)','`"overlay2"`'],
['`exec-opts`','Runtime options such as cgroup driver','`["native.cgroupdriver=systemd"]`'],
['`debug`','Verbose daemon logs','`true`']]},
{h:'A sensible example'},
{code:`{
  "data-root": "/data/docker",
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "default-address-pools": [
    { "base": "10.200.0.0/16", "size": 24 }
  ],
  "dns": ["10.0.0.2", "1.1.1.1"],
  "live-restore": true
}`},
{h:'Why these settings matter'},
{ul:['**Log rotation:** without limits, the default `json-file` driver can fill the disk with log files. Set `max-size` and `max-file` (or use the `local` driver, which rotates by default).','**Address pools:** if Docker default 172.17.0.0/16 range clashes with your corporate VPN or LAN, containers cannot reach those networks. Choose a free range.','**data-root:** move it to a larger disk when `/var/lib/docker` is on a small partition.']},
{h:'Apply a change safely'},
{flow:['Edit /etc/docker/daemon.json (valid JSON only)','Validate the file before restarting','Restart the daemon','Check docker info and the logs']},
{code:`sudo nano /etc/docker/daemon.json
sudo dockerd --validate --config-file=/etc/docker/daemon.json   # checks syntax and options
sudo systemctl restart docker          # most settings need a restart
docker info | grep -E "Root Dir|Logging|Cgroup"
journalctl -u docker -n 30 --no-pager

# A few options reload without a restart (send SIGHUP), e.g. debug, labels, live-restore:
sudo systemctl reload docker`},
{note:'Restarting dockerd stops all containers **unless** `live-restore` is enabled. Plan a maintenance window.'},
{h:'Moving data-root'},
{code:`sudo systemctl stop docker docker.socket containerd
sudo rsync -aHAX /var/lib/docker/ /data/docker/
# add "data-root": "/data/docker" to daemon.json
sudo systemctl start docker
docker info | grep "Docker Root Dir"
docker images && docker ps -a          # confirm everything is still there
# remove /var/lib/docker only after you are sure`},
{h:'Common errors'},
{t:[['Message','Cause'],
['`unable to configure the Docker daemon with file ...: invalid character`','JSON syntax error (trailing comma, missing quote)'],
['`the following directives are specified both as a flag and in the configuration file`','The same option is set in daemon.json **and** in the service command line (systemd unit). Keep one.'],
['Daemon will not start after edit','Run `journalctl -u docker -n 50`; fix or remove the offending key']]}],
src:[['Daemon configuration file',E+'daemon/'],['dockerd reference',R+'cli/dockerd/'],['Configure logging drivers',K.D+'engine/logging/configure/']]};

/* ---------- 5: Contexts, DOCKER_HOST, SSH ---------- */
L['docker:1:5']={blocks:[
{p:'The `docker` CLI is only a client, so it can control a daemon on **another computer**. This is how you manage servers from your laptop without logging in each time. The simplest secure transport is **SSH**.'},
{svg:remote},
{h:'Three ways to choose the target daemon'},
{t:[['Method','Example','Scope'],
['`-H` flag','`docker -H ssh://user@host ps`','One command'],
['`DOCKER_HOST` variable','`export DOCKER_HOST=ssh://user@host`','Current shell'],
['**Context**','`docker context use prod`','Saved and reusable; best choice']]},
{h:'Contexts'},
{p:'A **context** is a named, saved connection (endpoint and optional TLS settings). `default` is your local daemon.'},
{code:`# Create a context that connects over SSH
docker context create prod --docker "host=ssh://deploy@203.0.113.10"

docker context ls
docker context use prod          # all docker commands now run on the server
docker ps                        # containers on the server
docker context use default       # back to local

# Use a context for one command only
docker --context prod ps

# Inspect and remove
docker context inspect prod
docker context rm prod`},
{h:'What the server must have'},
{flow:['Docker Engine installed and running on the server','An SSH account you can reach with a key (no password prompt)','That account can use Docker (member of the docker group)','Docker CLI installed on your computer']},
{code:`# On your laptop: key-based SSH
ssh-keygen -t ed25519
ssh-copy-id deploy@203.0.113.10
ssh deploy@203.0.113.10 docker version      # test before creating the context`},
{p:'Behind the scenes, the CLI runs `docker system dial-stdio` through SSH, which links the CLI to the remote socket. Nothing new is opened on the server network.'},
{h:'DOCKER_HOST'},
{code:`export DOCKER_HOST=ssh://deploy@203.0.113.10
docker info | grep Name
unset DOCKER_HOST                # go back to local

# A TCP address also exists, but only use it with TLS (Additional content)
# DOCKER_HOST=tcp://host:2376 with DOCKER_TLS_VERIFY=1`},
{note:'Do not expose the daemon on `tcp://0.0.0.0:2375` without TLS. That port gives **unauthenticated root access** to anyone who can reach it.'},
{h:'Precedence'},
{p:'If several are set, the order is: the `-H` flag, then `--context`, then `DOCKER_HOST`, then the current saved context. Mixing `DOCKER_HOST` with contexts is a common cause of "why did that run on the wrong machine?" Always check `docker context ls`; the active one has a star.'},
{h:'Habits that prevent accidents'},
{ul:['Show the context in your shell prompt, or name contexts clearly (`prod`, `staging`).','Prefer `docker --context prod ...` for one-off commands.','Use separate SSH users and keys per environment.','Docker Desktop shows its own `desktop-linux` context; do not confuse it with your servers.']}],
src:[['Docker contexts',E+'manage-resources/contexts/'],['Protect the Docker daemon socket',E+'security/protect-access/'],['docker context',R+'cli/docker/context/']]};

/* ---------- 6: Upgrading, downgrading, uninstalling ---------- */
L['docker:1:6']={blocks:[
{p:'Changing the Docker version is routine work, but it restarts the daemon and can touch your data. A safe routine has three steps: **prepare**, **change**, **verify**.'},
{h:'Before you change anything'},
{t:[['Back up','How'],
['Configuration','Copy `/etc/docker/daemon.json` and any systemd override files'],
['Compose files and scripts','They live in your repositories; confirm they are committed'],
['Volume data','Back up important volumes (Section 7 shows how)'],
['Images you cannot rebuild','`docker save` them to a file or push to a registry'],
['The data-root (cold backup)','Stop Docker and copy `/var/lib/docker` if you need a full rollback']]},
{ul:['Read the **release notes** for removed features and breaking changes.','Note the running containers: `docker ps` and `docker compose ls`.','Check restart policies, so you know what will come back by itself.']},
{h:'Upgrade'},
{flow:['Back up and read the release notes','Update the package index','Install the newer packages (or a pinned version)','The daemon restarts; containers restart per their policy','Verify versions and application health']},
{code:`# Ubuntu / Debian
sudo apt-get update
sudo apt-mark unhold docker-ce docker-ce-cli          # if you had pinned them
sudo apt-get install --only-upgrade docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Fedora / CentOS
sudo dnf upgrade docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker version
docker ps
docker info | grep -E "Server Version|Live Restore"`},
{p:'With **live-restore** enabled, upgrading the daemon does not have to stop running containers. Without it, containers stop when dockerd stops and come back only if they have a restart policy.'},
{h:'Check client and daemon compatibility'},
{ul:['After an upgrade confirm that `docker version` shows matching Client and Server, and a healthy API version.','Remote clients, CI agents and tools that use the Engine API may need updating too (see the API minimum in Section 1).']},
{h:'Downgrade'},
{p:'A downgrade means installing an **older, specific version**. It is a recovery step, not a normal operation, and data written by a newer version may not be readable by an older one.'},
{code:`apt-cache madison docker-ce | awk '{print $3}' | head
sudo apt-get install -y --allow-downgrades docker-ce=<older-version> docker-ce-cli=<older-version>
sudo apt-mark hold docker-ce docker-ce-cli

# Fedora / CentOS
sudo dnf downgrade docker-ce-<version> docker-ce-cli-<version>`},
{h:'Uninstall'},
{p:'Removing the packages does **not** delete your images, containers and volumes; they stay in `/var/lib/docker`. Remove them yourself only if you really want a clean slate.'},
{code:`# 1. Remove the software (Ubuntu / Debian)
sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras

# 2. Optional: delete ALL images, containers, volumes (cannot be undone)
sudo rm -rf /var/lib/docker /var/lib/containerd

# 3. Optional: remove the repository and key, and configuration
sudo rm /etc/apt/sources.list.d/docker.list /etc/apt/keyrings/docker.asc
sudo rm -rf /etc/docker`},
{note:'Before deleting `/var/lib/docker`, double check there are no volumes holding data you want. There is no recycle bin.'},
{h:'Docker Desktop'},
{ul:['Upgrade from the update prompt inside the app, or install the newer installer on top.','Uninstall from the operating system apps list; choose whether to remove stored images and settings.']},
{h:'Rollback plan in one table'},
{t:[['Problem after upgrade','First response'],
['Daemon will not start','`journalctl -u docker`; restore your saved `daemon.json`'],
['A container misbehaves','Check logs; compare with release notes; roll back that image if it changed'],
['Tool reports API too old','Upgrade the tool'],
['Everything is broken','Reinstall the previous pinned version and restore the data backup']]}],
src:[['Docker Engine release notes',E+'release-notes/'],['Uninstall Docker Engine',E+'install/ubuntu/#uninstall-docker-engine'],['Live restore',E+'containers/live-restore/']]};
})();
