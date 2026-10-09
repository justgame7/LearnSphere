/* LearnSphere - Docker, Section 01: Introduction & Container Foundations.
   Lectures 0-4 are core, 5-7 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;

/* ---------- diagrams ---------- */
const vmct=K.dg(700,250,[
[10,10,330,230,'Virtual machine',1],[360,10,330,230,'Container',1],
[30,45,140,34,'App A',0],[185,45,140,34,'App B',0],[30,89,295,34,'Guest OS (a full kernel per VM)',0],[30,133,295,34,'Hypervisor',0],[30,177,295,40,'Host hardware',0],
[380,45,140,34,'App A',0],[535,45,140,34,'App B',0],[380,89,295,34,'Container runtime (namespaces + cgroups)',2],[380,133,295,34,'Host OS (ONE shared kernel)',0],[380,177,295,40,'Host hardware',0]],
[]);

const layers=K.dg(700,260,[
[10,10,330,240,'Image + container layers',1],[400,60,290,110,'What the container sees|(merged view of all layers)|one normal-looking filesystem',2],
[30,40,290,38,'Container layer (read-write, per container)',2],[30,88,290,34,'Image layer 3: app code (read-only)',0],[30,130,290,34,'Image layer 2: python packages (read-only)',0],[30,172,290,34,'Image layer 1: base OS files (read-only)',0],
[400,190,290,44,'Image layers are shared by every container',0]],
[[320,60,400,100],[320,150,400,120]]);

const arch=K.dg(700,260,[
[130,20,420,150,'Docker Engine (on the host)',1],
[10,70,100,56,'docker CLI|(client)',0],[150,70,110,56,'dockerd|(daemon)',2],[295,70,110,56,'containerd|(runtime manager)',0],[440,70,90,56,'runc|(OCI runtime)',0],[575,70,115,56,'Container|(Linux process)',2],
[150,195,110,50,'BuildKit|(builds images)',0],[295,195,110,50,'Registry|(Docker Hub etc)',0],[440,195,110,50,'Images, volumes,|networks (local)',0]],
[[110,98,150,98],[260,98,295,98],[405,98,440,98],[530,98,575,98],[205,126,205,195],[350,126,350,195],[485,126,485,195]]);

/* ---------- 0: Course overview ---------- */
L['docker:0:0']={blocks:[
{p:'This course takes you from zero to someone who can **build, ship, secure and run containers in production** with Docker. It follows the domains of the **DCA (Docker Certified Associate)** exam, but the goal is real skill: you should be able to containerize an application, connect and persist it, orchestrate it, and find the cause when something breaks. This first lecture explains how the course is organised and how to use it.'},
{h:'Key terms in one minute'},
{t:[['Term','Plain meaning'],
['**Image**','A read-only package: your app, its libraries and a minimal filesystem. A recipe plus ingredients, frozen.'],
['**Container**','A running (or stopped) instance of an image. The meal cooked from the recipe.'],
['**Registry**','A server that stores and serves images, for example Docker Hub.'],
['**Dockerfile**','A text file of build steps that produces an image.'],
['**Docker Engine**','The software on a host that builds images and runs containers.'],
['**Docker Compose**','Defines a multi-container app in one YAML file.'],
['**Swarm**','Docker built-in orchestrator that runs services across many hosts.']]},
{h:'The route through the course'},
{flow:['Foundations: containers, the platform, the editions (Section 1)','Install and configure Docker (Section 2)','Run and manage containers (Section 3)','Images, registries and building your own (Sections 4 and 5)','Networking and storage (Sections 6 and 7)','Compose, security and Swarm (Sections 8, 9 and 10)','Operate, troubleshoot and ship to production (Sections 11 and 12)']},
{h:'The twelve sections at a glance'},
{t:[['#','Section','After it you can'],
['1','Introduction & Container Foundations','Explain what a container is and how the Docker pieces fit together'],
['2','Installation & Daemon Configuration','Install Docker and configure the daemon'],
['3','Running & Managing Containers','Run, inspect, limit and restart containers'],
['4','Images & Registries','Pull, tag, push, save and secure images'],
['5','Building Images with Dockerfiles & BuildKit','Write small, fast, safe Dockerfiles'],
['6','Networking','Connect containers and publish ports'],
['7','Storage & Volumes','Keep data safe with volumes and mounts'],
['8','Docker Compose','Define and run multi-container apps'],
['9','Security','Harden containers, images and the daemon'],
['10','Docker Swarm & Orchestration','Run services across a cluster'],
['11','Logging, Monitoring & Troubleshooting','Find and fix problems'],
['12','CI/CD, Production Readiness & Capstone','Ship a real application']]},
{h:'How sections map to the DCA exam'},
{t:[['DCA domain','Weight','Main sections'],
['Orchestration','25%','10 (Swarm), supported by 8'],
['Image Creation, Management and Registry','20%','4 and 5'],
['Installation and Configuration','15%','2'],
['Networking','15%','6'],
['Security','15%','9'],
['Storage and Volumes','10%','7']]},
{p:'Sections 1, 3, 11 and 12 support every domain. Compose (Section 8) is a core developer skill that is not itself an exam domain.'},
{h:'Lecture tags: Engine, Desktop or Both'},
{p:'Docker runs in two main forms, and a few features exist in only one of them (you will meet both in lecture 4). Every lecture ends its title line with a tag so you know where a command applies.'},
{t:[['Tag','Meaning'],
['**Engine**','Docker Engine on a Linux host. The server-side form used in production.'],
['**Desktop**','Docker Desktop on Windows, macOS or Linux workstations.'],
['**Both**','Works the same on either form.']]},
{h:'Prerequisites self-check'},
{ul:['I can open a terminal and run commands such as `ls`, `cd`, `cat` and `curl`.','I know what a process, a port and an environment variable are.','I can read a YAML file (indentation shows structure).','I have a Linux machine or VM, or a Windows or Mac computer where I can install Docker.']},
{p:'If a box is unchecked, do not worry: the Linux refresher in Additional content covers the basics, and every command in this course is explained.'},
{h:'How to study'},
{ul:['Read the lecture, then **type the commands yourself**. Containers are learned by doing.','Take the section quiz after the lectures. Wrong answers link back to the lecture to re-read.','Do the Practical lecture at the end of each section without copying; use the lecture as a hint only.','Study plan, capstone and exam strategy are in the Additional content of this section.']},
{note:'A good habit for the whole course: after every change, run a command that **proves** it worked (for example `docker ps`, `docker inspect`, `docker logs`).'}],
src:[['Docker documentation',K.D],['Docker Certified Associate (Mirantis)','https://training.mirantis.com/certification/dca-certification-exam/']]};

/* ---------- 1: Containers vs VMs ---------- */
L['docker:0:1']={blocks:[
{p:'A **container** is not a tiny computer. It is an **ordinary Linux process** that the kernel has fenced in: it sees only its own processes, network and files (isolation), and it can use only a limited amount of CPU and memory (limits). Docker is a friendly tool that sets all this up for you.'},
{h:'Container vs virtual machine'},
{svg:vmct},
{t:[['','Virtual machine','Container'],
['Kernel','Own guest kernel per VM','Shares the host kernel'],
['Start time','Seconds to minutes (boots an OS)','Milliseconds to seconds (starts a process)'],
['Size','Gigabytes','Megabytes to a few hundred MB'],
['Isolation','Strong (hardware level)','Good (kernel level); a kernel bug can affect all'],
['Density','Tens per host','Hundreds per host'],
['Best for','Different operating systems, strongest isolation','Packaging and running apps quickly and consistently']]},
{note:'Containers on a Mac or Windows PC still need a Linux kernel. Docker Desktop quietly runs a small Linux VM and puts the containers inside it (lecture 4).'},
{h:'Three Linux features make containers work'},
{h:'1. Namespaces: what a process can SEE'},
{p:'A **namespace** gives a process its own private view of one kind of system resource.'},
{t:[['Namespace','Isolates','Effect inside the container'],
['`pid`','Process IDs','Your main process is PID 1; you cannot see host processes'],
['`net`','Network stack','Own interfaces, IP address, routes and ports'],
['`mnt`','Mount points','Own root filesystem'],
['`uts`','Hostname','Own hostname'],
['`ipc`','Shared memory and queues','Cannot talk to host processes through IPC'],
['`user`','User and group IDs','Root inside can map to an unprivileged user outside'],
['`cgroup`','The cgroup tree view','Sees only its own resource limits']]},
{h:'2. Control groups (cgroups): what a process can USE'},
{p:'A **cgroup** meters and limits CPU, memory, disk I/O and the number of processes. If a container tries to use more memory than its limit, the kernel kills the offending process (an **OOM kill**). Namespaces hide things; cgroups cap things.'},
{h:'3. Union filesystems: how image files are layered'},
{p:'An image is made of read-only **layers**. A **union filesystem** (Docker uses **overlay2** by default) stacks them and shows one combined view. Each container adds a thin **read-write layer** on top. This is **copy-on-write**: reading uses the shared layers, and the first time a file is changed it is copied up into the container layer.'},
{svg:layers},
{ul:['**Why it matters:** a hundred containers from one image share the same read-only layers on disk, so they start fast and use little space.','**Gotcha:** the container layer is deleted with the container, so data written there disappears. Section 7 shows how to keep data.']},
{h:'See it for yourself'},
{code:`# Run a container and compare what it sees with the host
docker run --rm -it alpine sh
  ps          # only a couple of processes; sh is PID 1
  hostname    # a random container ID, not your host name
  exit

# The same process, seen from the host (Linux)
docker run -d --name demo nginx
docker top demo                  # processes of the container
ps aux | grep nginx              # the host sees them as normal processes
docker rm -f demo`},
{h:'Common beginner mistakes'},
{ul:['Treating a container like a VM: logging in, installing things by hand, expecting it to live forever. Containers are **disposable**: rebuild the image instead.','Assuming containers are a perfect security boundary. They share a kernel; Section 9 covers hardening.','Storing important data in the container layer.']}],
src:[['Docker overview',K.D+'get-started/docker-overview/'],['Storage drivers: overlay2',E+'storage/drivers/overlayfs-driver/'],['Resource constraints',E+'containers/resource_constraints/']]};

/* ---------- 2: The Docker platform ---------- */
L['docker:0:2']={blocks:[
{p:'When you type `docker run nginx`, several programs cooperate. Knowing who does what makes errors and logs much easier to understand.'},
{h:'The pieces'},
{svg:arch},
{t:[['Component','What it is','Job'],
['**docker CLI**','The `docker` command (the client)','Turns your command into an API call. It does no real work itself.'],
['**dockerd**','The Docker daemon (a background service)','Owns images, networks, volumes and builds; exposes the Engine API.'],
['**containerd**','A high-level container runtime','Pulls and stores images, manages container lifecycle and snapshots.'],
['**runc**','A low-level runtime (OCI reference)','Actually creates the isolated process using namespaces and cgroups, then exits.'],
['**BuildKit**','The build engine','Executes Dockerfile builds with caching and parallelism.'],
['**Registry**','An image server (Docker Hub, private)','Stores and serves images.']]},
{h:'What happens on docker run nginx'},
{flow:['The CLI sends the request to dockerd through the Engine API','dockerd checks for the image locally; if missing it asks containerd to pull it from the registry','containerd unpacks the image layers into a snapshot','dockerd sets up the network and mounts, then asks containerd to start the container','containerd calls runc, which creates the namespaces and cgroups and starts the process','The container runs; runc exits and a small shim keeps watching the process']},
{h:'The Engine API and the socket'},
{p:'The CLI talks to the daemon over a **REST API**. On Linux the default address is the Unix socket `/var/run/docker.sock`. Anything that can write to that socket can control Docker, which is effectively **root on the host**. Section 9 explains why this matters.'},
{code:`# These two are the same request
docker ps
curl --unix-socket /var/run/docker.sock http://localhost/containers/json

# Client and server are separate programs: see both versions
docker version
docker info`},
{p:'Because the client and daemon are separate, the CLI can control a daemon on **another machine** (Section 2 shows how).'},
{h:'Images and registries'},
{p:'An **image** is pulled from a **registry** by name. The full name has three parts: `registry/repository:tag`.'},
{t:[['Example','Registry','Repository','Tag'],
['`nginx`','docker.io (default)','library/nginx','latest (default)'],
['`nginx:1.27`','docker.io','library/nginx','1.27'],
['`myuser/web:2.0`','docker.io','myuser/web','2.0'],
['`ghcr.io/org/app:v1`','ghcr.io','org/app','v1']]},
{h:'Why it is built in layers of tools'},
{ul:['**Open standards (OCI):** images and runtimes follow the Open Container Initiative specs, so containerd and runc can be used without Docker (for example by Kubernetes).','**Replaceable parts:** because runc is separate, other runtimes can be plugged in for extra isolation (Section 3 additional topics).','**Daemon restarts:** containerd and the shim can keep containers alive if only dockerd restarts (live-restore, Section 2).']},
{note:'Kubernetes no longer uses dockerd; it talks to containerd (or CRI-O) directly. Images you build with Docker still run there because they follow the OCI standard.'}],
src:[['Docker Engine overview',E],['Engine API',E+'api/'],['Docker architecture',K.D+'get-started/docker-overview/#docker-architecture']]};

/* ---------- 3: Engine vs Desktop vs Hub ---------- */
L['docker:0:3']={blocks:[
{p:'People say "Docker" for three different things. Keep them apart:'},
{t:[['Name','What it is','Where it runs','Typical use'],
['**Docker Engine**','The open-source daemon, CLI and plugins','Linux hosts (and Windows containers on Windows Server)','Servers and production'],
['**Docker Desktop**','An application bundling Engine, CLI, Compose, a Linux VM, a GUI and extras','Windows, macOS and Linux workstations','Development on a laptop'],
['**Docker Hub**','The default public image registry and web service','The cloud','Finding and sharing images']]},
{h:'Docker Engine'},
{ul:['Free and open source. You install it from your Linux distribution repositories or Docker repositories (Section 2).','Command line only; no GUI.','On Linux it runs directly on the host kernel: best performance and the platform used in production.']},
{h:'Docker Desktop'},
{p:'Containers need a Linux kernel. On Windows and macOS there is none, so Desktop runs a **lightweight Linux VM** and puts Engine inside it. Your `docker` command on the desktop talks into that VM.'},
{flow:['You type docker run in a Windows or Mac terminal','The CLI sends the request to Docker Desktop','Desktop forwards it to the Linux VM (WSL 2 on Windows, a hypervisor VM on Mac)','Engine inside the VM starts the container','Published ports are forwarded back to localhost']},
{t:[['Desktop adds','Why it helps'],
['Graphical dashboard','See containers, images and volumes'],
['Built-in Compose, buildx and Scout','Works out of the box'],
['Kubernetes (optional)','A one-node cluster for learning'],
['Resource settings','Choose CPU, memory and disk for the VM'],
['Extensions, Docker Model Runner, Gordon','Optional extras']]},
{h:'What changes on Desktop'},
{ul:['**File sharing is slower.** Bind-mounting your project folder crosses from your OS into the VM.','**Networking has an extra hop.** `localhost` inside a container is the container; to reach the host use `host.docker.internal`.','**Resources are capped** by the Desktop settings, not by the whole computer.','Some Engine-only features (such as host networking behaving like Linux) differ. Lectures tag these as Engine.']},
{h:'Docker Hub'},
{t:[['Image kind','What it means'],
['**Docker Official Images**','Curated images such as nginx, postgres, python, maintained to Docker guidelines'],
['**Verified Publisher**','Images from vendors Docker has verified'],
['**Docker-Sponsored Open Source**','Images from sponsored open-source projects'],
['Community images','Anyone can publish; check before trusting']]},
{p:'Hub also offers private repositories, organisations, access tokens and rate limits on anonymous or free pulls. Lecture 4 of Section 4 covers choosing images safely.'},
{h:'Licensing: what to know'},
{ul:['**Docker Engine** is open source and free to use.','**Docker Desktop** is free for personal use, education, non-commercial open source and small businesses. Larger companies need a paid subscription. Docker defines "small" by employee count and revenue.','Because the exact limits and plans change, always check the current Docker subscription page before standardising a team on Desktop.']},
{h:'Which should I use?'},
{t:[['Situation','Choice'],
['Production server or CI runner on Linux','Docker Engine'],
['Developer laptop on Windows or Mac','Docker Desktop (or Engine inside WSL 2 or a VM if licensing is a concern)'],
['Developer on Linux','Either; Engine is simplest'],
['Finding a base image or sharing yours','Docker Hub or a private registry']]}],
src:[['Docker Desktop overview',K.D+'desktop/'],['Docker Engine install overview',E+'install/'],['Docker Hub',K.D+'docker-hub/'],['Docker subscriptions',K.D+'subscription/']]};

/* ---------- 4: Releases, versions and the Engine API ---------- */
L['docker:0:4']={blocks:[
{p:'Docker has **three version numbers** that people mix up. Knowing which is which solves most "version mismatch" errors.'},
{t:[['Version','Example','What it describes'],
['**Engine (daemon) version**','28.0.1','The release of the Docker Engine software'],
['**CLI (client) version**','28.0.1','The release of the `docker` command'],
['**API version**','1.48','The version of the Engine API spoken between them']]},
{code:`docker version
# Client:
#  Version:        28.0.1
#  API version:    1.48
# Server: Docker Engine - Community
#  Engine:
#   Version:       28.0.1
#   API version:   1.48 (minimum version 1.24)`},
{p:'The numbers above are examples. Yours will differ.'},
{h:'How Engine versions are numbered'},
{ul:['Format **MAJOR.MINOR.PATCH**, for example `28.0.1`.','A new **major** release arrives a few times a year and may add features or remove old ones. Read the release notes before upgrading.','**Patch** releases fix bugs and security issues. Install them promptly.','Docker generally patches the **latest** release line, so plan to move forward rather than stay on an old major version.']},
{h:'The Engine API version'},
{p:'The daemon supports a **range** of API versions: a maximum (its own) and a minimum (the oldest client it still understands). A client says which version it speaks; if the daemon supports it, the call works.'},
{flow:['The CLI starts with its own API version','It asks the daemon for its supported range','If the client is newer, it automatically lowers itself to the daemon maximum (negotiation)','If the client is older than the daemon minimum, the call fails with a version error']},
{t:[['Situation','Result'],
['Client and daemon same version','Works'],
['Newer client, older daemon','Usually works; client negotiates down, newer features unavailable'],
['Older client, newer daemon','Works only while the client API version is at or above the daemon minimum'],
['Client far older than the minimum','Error: client version too old']]},
{p:'Version note: **Engine 29 raised the minimum supported API version to 1.44**, so very old clients and old tools that hard-code an API version stop working against it.'},
{h:'Checking and pinning'},
{code:`docker version --format "{{.Server.Version}} api={{.Server.APIVersion}} min={{.Server.MinAPIVersion}}"

# Force an older API version for one command (helps legacy tools)
DOCKER_API_VERSION=1.44 docker ps

# Check which release a package manager would install (Debian/Ubuntu)
apt-cache madison docker-ce | head`},
{h:'Typical error and fix'},
{code:`Error response from daemon: client version 1.24 is too old.
Minimum supported API version is 1.44, please upgrade your client

# Fix: upgrade the tool or client that is calling the API.
# Do not lower the daemon floor unless you must; check the release notes first.`},
{h:'Good practice'},
{ul:['Keep the **client and daemon on the same release** where you can.','Read release notes for removed or changed features before every major upgrade.','Test upgrades on a staging host first and back up (Section 2).','Pin versions in automation instead of floating on "latest".']}],
src:[['Docker Engine release notes',E+'release-notes/'],['Engine API versions',E+'api/#api-version-matrix'],['Engine API: version negotiation',E+'api/#versioned-api-and-sdk']]};
})();
