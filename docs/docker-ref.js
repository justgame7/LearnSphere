/* LearnSphere - Docker Quick Reference (cheat sheet).
   window.QREF['docker'] = {title, blurb, hint, pages:[{t, d, see:[[sectionIndex, lectureIndex, label]...], b:[blocks]}]}
   Written for Docker Engine 27+ and Compose v2. Verify flags with docker <command> --help. */
window.QREF=window.QREF||{};
window.QREF['docker']={title:'Docker Quick Reference',blurb:'Commands, files, ports, Dockerfile and Compose keys and fixes for Docker, plus maps of the platform, builds, networking and common tasks.',hint:'exit code 137',pages:[

/* 0 ---------------------------------------------------------------- key concepts */
{t:'Key concepts',d:'The ideas every Docker user should be able to explain, grouped by area. Tap a concept to open it.',see:[],b:[
{p:'Each concept opens to a short explanation, why it matters in day-to-day work, one command to check it, and a link to the lesson that teaches it in full. Use the filter box to find a concept by any word in it.'},

{h:'Architecture and images'},
{acc:[
{t:'Containers are isolated processes',s:'Not small virtual machines.',
 a:'A container is a normal Linux process with its own **namespaces** (what it sees) and **cgroups** (how much it may use), started from an image\'s filesystem. It shares the host kernel.',
 w:'It explains why containers start in a second, and why a kernel problem affects all of them.',
 c:`docker run --rm alpine ps
ps -ef | grep -c containerd-shim`,see:[0,1,'Containers vs virtual machines: namespaces, cgroups and union filesystems']},
{t:'The platform stack',s:'CLI, dockerd, containerd, runc.',
 a:'The `docker` CLI calls the **dockerd** API. dockerd uses **containerd** to manage images and containers, which calls **runc** to create the process. **BuildKit** builds images.',
 w:'When something breaks, knowing the layer tells you which log to read.',
 c:`docker version
docker info | head -30`,see:[0,2,'The Docker platform: CLI, dockerd, containerd, runc, BuildKit and registries']},
{t:'Image layers and digests',s:'Read-only layers plus a manifest.',
 a:'An image is a stack of read-only **layers**, a **config** and a **manifest**, addressed by a content **digest**. A container adds a thin writable layer on top. Tags are movable labels, digests are not.',
 w:'Layer reuse makes pulls and builds fast, and digests make deployments reproducible.',
 c:`docker image inspect nginx:1.27 --format '{{.RepoDigests}} {{len .RootFS.Layers}} layers'
docker history nginx:1.27`,see:[3,0,'Image anatomy: layers, manifests, config and digests']},
{t:'Tags and immutability',s:'Pin what you deploy.',
 a:'A tag such as `latest` can point to different images over time. Deploy by version tag and, for production, by **digest**, and promote the same image between registries.',
 w:'`latest` is the usual reason "it worked yesterday".',
 c:`docker pull nginx:1.27@sha256:<digest>`,see:[3,7,'Tags, versioning and immutability']},
{t:'Registries',s:'Where images live.',
 a:'A registry stores images by repository and tag. Docker Hub is the default, and private registries (including `registry:2`) need `docker login` and credential helpers.',
 w:'Pull limits, authentication and TLS are the usual registry problems.',
 c:`docker login registry.example.com
docker push registry.example.com/team/app:1.0`,see:[3,4,'Private registries: login, credential helpers and running registry:2']}
]},

{h:'Running containers'},
{acc:[
{t:'docker run anatomy',s:'One command, many decisions.',
 a:'`docker run` creates and starts a container: image, name, command, environment, ports, volumes, network, restart policy and limits. `-d` runs detached, `--rm` removes it on exit.',
 w:'Most day-to-day problems come from one flag.',
 c:`docker run -d --name web -p 8080:80 --restart unless-stopped nginx:1.27`,see:[2,0,'Anatomy of docker run']},
{t:'Container lifecycle',s:'created, running, paused, exited.',
 a:'A container moves between **created**, **running**, **paused**, **exited** and **removed**. Exited containers and their writable layers stay until removed.',
 w:'Stopped containers hold disk space and their logs.',
 c:`docker ps -a
docker container prune`,see:[2,1,'Container lifecycle and states']},
{t:'Inspect, logs and exec',s:'Look before you change.',
 a:'`inspect` shows configuration and state, `logs` shows what the main process wrote to stdout and stderr, `exec` runs a command inside, `stats` shows live use.',
 w:'These four answer most questions about a container.',
 c:`docker inspect web --format '{{.State.Status}} {{.State.ExitCode}}'
docker logs --tail 50 web`,see:[2,2,'Inspecting containers: ps, inspect, logs, top and stats']},
{t:'Restart policies',s:'What happens after an exit.',
 a:'`no`, `on-failure[:n]`, `always` and `unless-stopped` define restarts. A policy does not fix a crashing container: it just restarts it.',
 w:'Use a policy for services, and read the exit code for the cause.',
 c:`docker inspect web --format '{{.HostConfig.RestartPolicy.Name}} {{.RestartCount}}'`,see:[2,5,'Restart policies and starting containers automatically']},
{t:'CPU, memory and PIDs limits',s:'Without limits one container can starve the host.',
 a:'`--memory`, `--cpus` and `--pids-limit` set cgroup limits. Exceeding the memory limit gets the process **OOM killed** (exit code 137).',
 w:'Set memory limits for every production container.',
 c:`docker run -d --memory 512m --cpus 1.5 --pids-limit 200 app:1.0
docker stats --no-stream`,see:[2,6,'Resource constraints: CPU, memory and PIDs']},
{t:'Health checks',s:'Is it working, not just running.',
 a:'A **HEALTHCHECK** runs a command at an interval and marks the container healthy or unhealthy. Compose and Swarm use it for ordering and replacement.',
 w:'Without one, "running" only means the process exists.',
 c:`docker inspect web --format '{{json .State.Health}}'`,see:[2,7,'Health checks']}
]},

{h:'Building images'},
{acc:[
{t:'Dockerfile and build context',s:'What goes into the build.',
 a:'The **context** is the directory sent to the builder. `.dockerignore` keeps unneeded and secret files out. Instructions `FROM`, `COPY`, `RUN` and others create layers.',
 w:'A huge context makes builds slow and may leak files into images.',
 c:`docker build -t app:1.0 .
cat .dockerignore`,see:[4,2,'Build context and .dockerignore']},
{t:'CMD and ENTRYPOINT',s:'What runs at start.',
 a:'**ENTRYPOINT** is the fixed executable and **CMD** the default arguments. Use the exec form (JSON array) so the process is PID 1 and receives signals.',
 w:'The shell form hides signals and delays shutdown.',
 c:`docker inspect app:1.0 --format '{{.Config.Entrypoint}} {{.Config.Cmd}}'`,see:[4,3,'CMD vs ENTRYPOINT, shell vs exec form']},
{t:'Layer caching',s:'Order instructions by change rate.',
 a:'Docker reuses a layer if the instruction and its inputs are unchanged. Put rarely changing steps (dependencies) before frequently changing ones (source).',
 w:'It is the biggest lever on build time.',
 c:`docker build --progress=plain .`,see:[4,5,'Layers, caching and Dockerfile best practices']},
{t:'Multi-stage builds',s:'Build big, ship small.',
 a:'A first stage with compilers produces artefacts, and a final stage copies only those into a minimal runtime image.',
 w:'Smaller images pull faster and have less attack surface.',
 c:`docker build --target runtime -t app:1.0 .`,see:[4,6,'Multi-stage builds']},
{t:'Build secrets',s:'Never bake secrets into layers.',
 a:'BuildKit `--mount=type=secret` and `type=ssh` give a build temporary access without writing the value to any layer or to history.',
 w:'`ARG` and `ENV` values remain visible in image history.',
 c:`docker build --secret id=npmrc,src=$HOME/.npmrc .`,see:[4,8,'Build secrets and SSH mounts']}
]},

{h:'Networking and storage'},
{acc:[
{t:'Bridge networks',s:'Default versus user-defined.',
 a:'The default bridge has no name-based discovery. A **user-defined bridge** gives containers DNS names, better isolation and live attach and detach.',
 w:'Always create a network per application.',
 c:`docker network create appnet
docker network inspect appnet`,see:[5,1,'Default bridge vs user-defined bridge networks']},
{t:'Publishing ports',s:'-p host:container.',
 a:'`-p 8080:80` maps a host port to a container port using NAT. Bind to `127.0.0.1` when only local access is intended. `EXPOSE` only documents.',
 w:'A published port is reachable from the network unless bound to loopback or filtered.',
 c:`docker port web
ss -ltnp | grep 8080`,see:[5,3,'Publishing ports: -p, host IP binding and EXPOSE']},
{t:'Container DNS',s:'Names on user-defined networks.',
 a:'Containers on the same user-defined network resolve each other by container and service name through Docker\'s embedded DNS (127.0.0.11).',
 w:'A hard-coded IP breaks on every restart.',
 c:`docker exec web getent hosts db`,see:[5,2,'Container DNS and service discovery']},
{t:'The writable layer',s:'Why data disappears.',
 a:'Changes inside a container live in its writable layer and are lost when the container is removed. Persist data in a volume or bind mount.',
 w:'It is the first thing to check when "my data is gone".',
 c:`docker diff web`,see:[6,0,'The writable layer and why data disappears']},
{t:'Volumes, bind mounts and tmpfs',s:'Pick by purpose.',
 a:'**Volumes** are managed by Docker and portable, **bind mounts** map a host path (convenient and riskier), **tmpfs** lives in memory only.',
 w:'Use volumes for data and bind mounts for development source code.',
 c:`docker volume ls
docker run -v data:/var/lib/postgresql/data postgres:16`,see:[6,4,'Choosing between volumes, bind mounts and tmpfs']}
]},

{h:'Compose, Swarm and security'},
{acc:[
{t:'compose.yaml',s:'An application as a file.',
 a:'Compose describes **services**, **networks** and **volumes** in one file and creates them together. `up` makes it so, `down` removes it, with named volumes preserved unless `-v`.',
 w:'It is the standard way to run multi-container apps on one host.',
 c:`docker compose config
docker compose up -d`,see:[7,1,'compose.yaml: services, networks and volumes']},
{t:'Startup order and health',s:'depends_on with conditions.',
 a:'`depends_on` with `condition: service_healthy` waits for a health check. Without it, only the start order is controlled, not readiness.',
 w:'Most "database not ready" errors at start come from this.',
 c:`docker compose ps`,see:[7,4,'Startup order, dependencies and health checks']},
{t:'Swarm services',s:'Desired replicas across nodes.',
 a:'A **service** declares an image, replica count and update policy. Swarm schedules **tasks** on nodes and replaces failed ones. **Managers** keep state with Raft and need a quorum.',
 w:'Use an odd number of managers.',
 c:`docker service ls
docker service ps web`,see:[9,2,'Services: create, scale, replicated vs global, placement constraints']},
{t:'Non-root and capabilities',s:'Reduce what a container can do.',
 a:'Run as a non-root `USER`, drop capabilities (`--cap-drop ALL`), keep the default seccomp profile and avoid `--privileged`.',
 w:'A container escape starts with what the container may already do.',
 c:`docker run --user 10001 --cap-drop ALL --read-only app:1.0`,see:[8,2,'Capabilities, seccomp, AppArmor and SELinux']},
{t:'The Docker socket',s:'Access means root.',
 a:'Anyone who can use `/var/run/docker.sock` can start a privileged container, which is root on the host. Do not mount it into containers and do not expose the API without TLS.',
 w:'It is the most common serious misconfiguration.',
 c:`ls -l /var/run/docker.sock
id`,see:[8,3,'Protecting the daemon socket']}
]},

]},

/* 0b ---------------------------------------------------------------- big-picture maps */
{t:'Big-picture maps',d:'Four small maps of how the parts fit together: the platform, image builds, networking and a Compose application.',see:[],jump:true,b:[
{p:'Each map is deliberately small. Tap a box to see what it is, why it matters, one command to check it and the lesson behind it. Where a map has a **Trace** button, it walks one action through the boxes in order.'},

{h:'1. Platform architecture'},
{map:{title:'Platform map',h:328,trace:'Run a container',
 hint:'Tap any box, or press Run a container to follow a docker run through the layers.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L226 107 L226 134',[326,164,352,164],'M454 192 L454 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'cli',x:21,y:24,w:194,h:56,c:'ext',t:'docker CLI',s:'the client',d:'Parses the command and calls the daemon API over a Unix socket or TCP.',why:'The context decides which daemon it talks to.',chk:`docker context ls`,see:[1,5,'CLI contexts, DOCKER_HOST and basic remote access over SSH']},
 {id:'api',x:243,y:24,w:194,h:56,c:'proc',t:'dockerd',s:'Engine API',d:'The daemon: networks, volumes, builds and the API. It delegates containers to containerd.',why:'Configured in daemon.json.',chk:`docker info | head`,see:[0,2,'The Docker platform']},
 {id:'reg',x:465,y:24,w:194,h:56,c:'ext',t:'Registry',s:'images',d:'Source of images when they are not local.',why:'Authentication and rate limits.',chk:`docker pull alpine:3.20`,see:[3,3,'Docker Hub, official images and trusted content']},
 {id:'ctr',x:126,y:136,w:200,h:56,c:'proc',t:'containerd',s:'image and lifecycle',d:'Pulls and unpacks images, manages snapshots and container lifecycle.',why:'A shim keeps each container running.',chk:`sudo ctr -n moby containers ls`,see:[0,2,'The Docker platform']},
 {id:'runc',x:354,y:136,w:200,h:56,c:'proc',t:'runc',s:'creates the process',d:'An OCI runtime that sets up namespaces and cgroups and starts the process.',why:'Replaceable with other runtimes.',chk:`docker info --format '{{.Runtimes}}'`,see:[0,2,'The Docker platform']},
 {id:'ns',x:126,y:248,w:200,h:56,c:'mem',t:'Namespaces, cgroups',s:'isolation and limits',d:'Namespaces isolate PID, network, mounts and more. Cgroups limit CPU, memory and PIDs.',why:'Limits apply here.',chk:`docker inspect web --format '{{.HostConfig.Memory}}'`,see:[0,1,'Containers vs virtual machines']},
 {id:'store',x:354,y:248,w:200,h:56,c:'disk',t:'Image store',s:'/var/lib/docker',d:'Layers, volumes and container data under the data-root.',why:'Watch the disk.',chk:`docker system df`,see:[1,4,'The daemon and daemon.json']}],
 steps:[
 {ids:['cli','api'],t:'1. The CLI sends the request to dockerd.',w:'One API, many clients.',s:'Context, socket.',x:'Permission denied on the socket.',c:`docker version`},
 {ids:['reg'],t:'2. If the image is not local, it is pulled layer by layer.',w:'Layers shared with other images are skipped.',s:'Registry, login.',x:'Pull rate limit or auth failure.',c:`docker pull alpine:3.20`},
 {ids:['ctr','store'],t:'3. containerd unpacks the layers into a snapshot with a writable layer.',w:'Starting is cheap.',s:'Storage driver.',x:'Disk full.',c:`docker system df`},
 {ids:['runc','ns'],t:'4. runc creates namespaces and cgroups and starts the process.',w:'This is the container.',s:'Runtime, limits.',x:'OOM kill from a memory limit.',c:`docker stats --no-stream`}]}},

{h:'2. Image build and layers'},
{map:{title:'Build map',h:216,trace:'Build and ship an image',
 hint:'Tap any box, or press Build and ship an image to follow source code to a running container.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'ctx',x:21,y:24,w:194,h:56,c:'ext',t:'Build context',s:'files sent',d:'The directory sent to the builder, filtered by .dockerignore.',why:'Keep secrets and junk out.',chk:`cat .dockerignore`,see:[4,2,'Build context and .dockerignore']},
 {id:'df',x:243,y:24,w:194,h:56,c:'proc',t:'Dockerfile',s:'instructions',d:'FROM, COPY, RUN, USER, CMD. Each creates a layer or metadata.',why:'Order for cache reuse.',chk:`docker build -t app:1.0 .`,see:[4,0,'Dockerfile basics']},
 {id:'bk',x:465,y:24,w:194,h:56,c:'proc',t:'BuildKit',s:'parallel builder',d:'Builds stages in parallel with a cache and secret mounts.',why:'Use `buildx` for more options.',chk:`docker buildx ls`,see:[4,7,'BuildKit, buildx, builders and build checks']},
 {id:'lay',x:21,y:136,w:194,h:56,c:'disk',t:'Layers and cache',s:'reuse',d:'Unchanged steps are reused from cache.',why:'A change invalidates every later layer.',chk:`docker history app:1.0`,see:[4,5,'Layers, caching and Dockerfile best practices']},
 {id:'reg',x:243,y:136,w:194,h:56,c:'ext',t:'Registry',s:'push',d:'Stores the image under a tag and digest.',why:'Tag with a version and record the digest.',chk:`docker push registry.example.com/app:1.0`,see:[3,4,'Private registries']},
 {id:'run',x:465,y:136,w:194,h:56,c:'mem',t:'Running container',s:'pull and run',d:'The deployment host pulls by tag or digest and runs.',why:'Same image everywhere.',chk:`docker run -d registry.example.com/app:1.0`,see:[11,1,'Release tagging, digest pinning and registry promotion']}],
 steps:[
 {ids:['ctx','df'],t:'1. The builder receives the context and reads the Dockerfile.',w:'Only what is in the context can be copied.',s:'.dockerignore.',x:'Large or sensitive context.',c:`docker build --progress=plain .`},
 {ids:['bk','lay'],t:'2. BuildKit runs the stages, reusing cached layers where inputs are unchanged.',w:'Caching saves most time.',s:'Instruction order.',x:'Cache broken by an early change.',c:`docker build --progress=plain . | grep CACHED`},
 {ids:['reg'],t:'3. The image is tagged and pushed.',w:'A release artefact.',s:'Tag scheme.',x:'Pushing latest only.',c:`docker push registry.example.com/app:1.0`},
 {ids:['run'],t:'4. The target host pulls the same image and runs it.',w:'Reproducible.',s:'Digest pinning.',x:'A moved tag.',c:`docker inspect app:1.0 --format '{{.Id}}'`}]}},

{h:'3. Networking'},
{map:{title:'Networking map',h:328,trace:'Reach a published port',
 hint:'Tap any box, or press Reach a published port to follow a request from the network to a container.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M226 248 L226 221 L340 221 L340 194','M454 248 L454 221 L562 221 L562 194'],
 nodes:[
 {id:'cl',x:21,y:24,w:194,h:56,c:'ext',t:'Client',s:'outside the host',d:'Connects to the host IP and a published port.',why:'Check the firewall.',chk:`curl http://<host>:8080`,see:[5,3,'Publishing ports']},
 {id:'host',x:243,y:24,w:194,h:56,c:'net',t:'Host port',s:'8080',d:'A listening port created by publishing with -p.',why:'Bind to 127.0.0.1 if local only.',chk:`ss -ltnp | grep 8080`,see:[5,3,'Publishing ports']},
 {id:'ipt',x:465,y:24,w:194,h:56,c:'proc',t:'NAT and filtering',s:'iptables or nftables',d:'Docker programs rules that rewrite the destination to the container IP.',why:'Docker rules bypass some host firewall configurations.',chk:`sudo iptables -t nat -L DOCKER -n`,see:[5,6,'Packet filtering and published-port exposure']},
 {id:'br',x:21,y:136,w:194,h:56,c:'net',t:'Bridge network',s:'docker0 or user bridge',d:'A virtual switch connecting containers on the host.',why:'User-defined bridges give DNS.',chk:`docker network inspect bridge`,see:[5,1,'Default bridge vs user-defined bridge networks']},
 {id:'c1',x:243,y:136,w:194,h:56,c:'mem',t:'Container A',s:'web',d:'Listens on the container port.',why:'It must listen on 0.0.0.0, not 127.0.0.1.',chk:`docker exec web ss -ltn`,see:[5,0,'The Docker networking model and drivers']},
 {id:'c2',x:465,y:136,w:194,h:56,c:'mem',t:'Container B',s:'db',d:'Reached by name from A over the bridge.',why:'No published port needed.',chk:`docker exec web getent hosts db`,see:[5,2,'Container DNS and service discovery']},
 {id:'dns',x:126,y:248,w:200,h:56,c:'net',t:'Embedded DNS',s:'127.0.0.11',d:'Resolves container and service names on user-defined networks.',why:'Not available on the default bridge.',chk:`docker exec web cat /etc/resolv.conf`,see:[5,2,'Container DNS and service discovery']},
 {id:'vol',x:354,y:248,w:200,h:56,c:'disk',t:'Volume',s:'data for db',d:'Holds the database files outside the container.',why:'Network is not storage.',chk:`docker volume inspect dbdata`,see:[6,1,'Volumes: create, mount and inspect']}],
 steps:[
 {ids:['cl','host'],t:'1. A client connects to the host port.',w:'Only published ports are reachable.',s:'-p mapping.',x:'Not published, or firewalled.',c:`docker port web`},
 {ids:['ipt'],t:'2. NAT rewrites the destination to the container address.',w:'Transparent to the app.',s:'Rules.',x:'Rules missing after a firewall reload.',c:`sudo iptables -t nat -S | grep DNAT`},
 {ids:['br','c1'],t:'3. The bridge delivers the packet to the container.',w:'Private network.',s:'Subnet.',x:'Overlapping subnets.',c:`docker network inspect appnet`},
 {ids:['c2','dns'],t:'4. Container A reaches B by name through embedded DNS.',w:'Names, not IPs.',s:'User-defined network.',x:'Different networks.',c:`docker exec web ping -c1 db`}]}},

{h:'4. Compose application'},
{map:{title:'Compose map',h:216,trace:'Bring up a stack',
 hint:'Tap any box, or press Bring up a stack to follow docker compose up through its objects.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'file',x:21,y:24,w:194,h:56,c:'ext',t:'compose.yaml',s:'the model',d:'Declares services, networks, volumes, secrets and configs.',why:'Validate with `compose config`.',chk:`docker compose config`,see:[7,1,'compose.yaml']},
 {id:'env',x:243,y:24,w:194,h:56,c:'mem',t:'.env and variables',s:'interpolation',d:'Values substituted into the file, with a defined precedence.',why:'Shell values override .env.',chk:`docker compose config | grep image`,see:[7,3,'Environment variables, .env, interpolation and precedence']},
 {id:'svc',x:465,y:24,w:194,h:56,c:'proc',t:'Services',s:'containers',d:'One or more containers per service created from an image or build.',why:'Scale with `--scale`.',chk:`docker compose ps`,see:[7,2,'Compose CLI']},
 {id:'net',x:21,y:136,w:194,h:56,c:'net',t:'Project network',s:'default bridge',d:'A user-defined network for the project, giving DNS by service name.',why:'Use names, not IPs.',chk:`docker network ls | grep <project>`,see:[7,1,'compose.yaml']},
 {id:'vol',x:243,y:136,w:194,h:56,c:'disk',t:'Named volumes',s:'kept on down',d:'Persist data and survive `down` unless `-v` is given.',why:'Be careful with `down -v`.',chk:`docker volume ls`,see:[7,1,'compose.yaml']},
 {id:'hc',x:465,y:136,w:194,h:56,c:'warn',t:'Health and order',s:'depends_on',d:'Wait for dependencies with health conditions.',why:'Otherwise the app starts too early.',chk:`docker compose ps`,see:[7,4,'Startup order, dependencies and health checks']}],
 steps:[
 {ids:['file','env'],t:'1. Compose reads the file and interpolates variables.',w:'One model of the app.',s:'Variables.',x:'Unset variables become blank.',c:`docker compose config`},
 {ids:['net','vol'],t:'2. It creates the network and volumes.',w:'Shared infrastructure first.',s:'Names.',x:'Name clashes.',c:`docker network ls`},
 {ids:['svc','hc'],t:'3. Services start in dependency order, waiting for health where configured.',w:'Order is explicit.',s:'depends_on.',x:'Start does not mean ready.',c:`docker compose up -d`}]}},

]},

/* 0c ---------------------------------------------------------------- process maps */
{t:'Process maps',d:'Four small maps of how something happens, step by step: a container that will not start, shipping an image, a Swarm update and hardening a container.',see:[],jump:true,b:[
{p:'These maps follow one task from start to finish. Press the trace button and step through. Each step says what happens, why, which settings control it, what can go wrong and how to see it.'},

{h:'1. A container that will not start'},
{map:{title:'Start failure map',h:328,trace:'Find why it exited',
 hint:'Tap any box, or press Find why it exited to follow the checks.',
 lines:[[215,52,241,52],[437,52,463,52],'M562 80 L562 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164],'M562 192 L562 219 L226 219 L226 246',[326,276,352,276]],
 nodes:[
 {id:'ps',x:21,y:24,w:194,h:56,c:'mem',t:'Status',s:'docker ps -a',d:'Shows whether the container is Exited, Restarting or Created and when.',why:'A restarting container loops quickly.',chk:`docker ps -a --filter name=web`,see:[10,3,'A container that will not start: exit codes and OOMKilled']},
 {id:'logs',x:243,y:24,w:194,h:56,c:'mem',t:'Logs',s:'stdout and stderr',d:'The application\'s last output often names the cause.',why:'Look at the last 50 lines.',chk:`docker logs --tail 50 web`,see:[10,0,'Container logs and logging drivers']},
 {id:'code',x:465,y:24,w:194,h:56,c:'mem',t:'Exit code',s:'what ended it',d:'0 clean, 1 error, 125 daemon error, 126 not executable, 127 command not found, 137 killed, 139 segfault, 143 SIGTERM.',why:'137 usually means out of memory.',chk:`docker inspect web --format '{{.State.ExitCode}} {{.State.OOMKilled}}'`,see:[10,3,'A container that will not start']},
 {id:'oom',x:21,y:136,w:194,h:56,c:'warn',t:'OOMKilled',s:'memory limit',d:'The kernel killed it for exceeding the memory limit.',why:'Raise the limit or fix the leak.',chk:`docker inspect web --format '{{.State.OOMKilled}}'`,see:[2,6,'Resource constraints']},
 {id:'cfg',x:243,y:136,w:194,h:56,c:'warn',t:'Config, entrypoint',s:'wrong command',d:'Bad entrypoint, missing file, wrong user permissions.',why:'Run with `--entrypoint sh`.',chk:`docker run --rm -it --entrypoint sh app:1.0`,see:[4,3,'CMD vs ENTRYPOINT']},
 {id:'img',x:465,y:136,w:194,h:56,c:'warn',t:'Image, platform',s:'pull or arch',d:'Wrong architecture or a failed pull.',why:'Check the platform.',chk:`docker image inspect app:1.0 --format '{{.Architecture}}'`,see:[10,4,'Troubleshooting images and builds']},
 {id:'net',x:126,y:248,w:200,h:56,c:'warn',t:'Port or network',s:'bind failed',d:'The published port is already in use.',why:'Find the other process.',chk:`ss -ltnp | grep 8080`,see:[10,5,'Troubleshooting networking and DNS']},
 {id:'fix',x:354,y:248,w:200,h:56,c:'proc',t:'Fix and rerun',s:'one change',d:'Change one thing and run again.',why:'Write down the cause.',chk:`docker compose up -d web`,see:[10,7,'Practical: Break/Fix scenarios']}],
 steps:[
 {ids:['ps','logs'],t:'1. Look at the status and read the last logs.',w:'Usually enough.',s:'Logging driver.',x:'A driver that hides `docker logs`.',c:`docker logs web`},
 {ids:['code','oom'],t:'2. Read the exit code and the OOMKilled flag.',w:'They separate the causes.',s:'Exit codes.',x:'Mistaking 137 for a crash.',c:`docker inspect web --format '{{.State.ExitCode}}'`},
 {ids:['cfg','img'],t:'3. Start with a shell entrypoint to check files, permissions and platform.',w:'Reproduce interactively.',s:'Entrypoint.',x:'Running as a different user.',c:`docker run --rm -it --entrypoint sh app:1.0`},
 {ids:['net','fix'],t:'4. Check ports and networks, make one change and verify.',w:'Close the loop.',s:'Port mapping.',x:'Port already used.',c:`docker ps`}]}},

{h:'2. Shipping an image to production'},
{map:{title:'Release map',h:216,trace:'Build, scan, tag and promote',
 hint:'Tap any box, or press Build, scan, tag and promote to follow a release pipeline.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'bld',x:126,y:24,w:200,h:56,c:'proc',t:'Build and test',s:'CI',d:'Build from a clean checkout and run tests, ideally in the same image.',why:'Use a pinned base image.',chk:`docker build -t app:$GIT_SHA .`,see:[11,2,'Docker in CI/CD: build, test and push']},
 {id:'scn',x:354,y:24,w:200,h:56,c:'warn',t:'Scan',s:'Scout or similar',d:'Check the image for known vulnerabilities and generate an SBOM.',why:'Fail on critical findings.',chk:`docker scout cves app:$GIT_SHA`,see:[8,5,'Scanning images with Docker Scout']},
 {id:'tag',x:21,y:136,w:194,h:56,c:'mem',t:'Tag',s:'version and sha',d:'Tag with a version and the commit, never only latest.',why:'Record the digest.',chk:`docker tag app:$GIT_SHA registry.example.com/app:1.4.2`,see:[11,1,'Release tagging, digest pinning and registry promotion']},
 {id:'prm',x:243,y:136,w:194,h:56,c:'ext',t:'Promote',s:'same image',d:'Push to the registry and promote the same digest between environments.',why:'Do not rebuild for production.',chk:`docker buildx imagetools create -t registry.example.com/app:prod registry.example.com/app:1.4.2`,see:[11,1,'Release tagging, digest pinning and registry promotion']},
 {id:'dep',x:465,y:136,w:194,h:56,c:'proc',t:'Deploy',s:'compose or swarm',d:'Update the running stack to the new digest and watch health.',why:'Keep the previous tag for rollback.',chk:`docker service update --image registry.example.com/app:1.4.2 web`,see:[9,3,'Rolling updates and rollbacks']}],
 steps:[
 {ids:['bld','scn'],t:'1. Build from a clean checkout, test and scan.',w:'Catch problems before the registry.',s:'Pinned base.',x:'Scanning only after release.',c:`docker scout cves app:$GIT_SHA`},
 {ids:['tag','prm'],t:'2. Tag with a version, push and promote the same digest.',w:'What was tested is what runs.',s:'Tag policy.',x:'Rebuilding per environment.',c:`docker buildx imagetools inspect registry.example.com/app:1.4.2`},
 {ids:['dep'],t:'3. Deploy with a rolling update and verify health.',w:'Rollback is available.',s:'Update config.',x:'No health check.',c:`docker service ps web`}]}},

{h:'3. Rolling update in Swarm'},
{map:{title:'Swarm update map',h:216,trace:'Update and roll back a service',
 hint:'Tap any box, or press Update and roll back a service to follow a service update.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'upd',x:126,y:24,w:200,h:56,c:'ext',t:'Update the service',s:'new image',d:'`docker service update --image` creates new tasks with the new spec.',why:'Config changes also trigger it.',chk:`docker service update --image app:2.0 web`,see:[9,3,'Rolling updates and rollbacks']},
 {id:'par',x:354,y:24,w:200,h:56,c:'mem',t:'Parallelism, delay',s:'pace',d:'`--update-parallelism` and `--update-delay` control batch size and wait time.',why:'Set both for safety.',chk:`docker service inspect web --format '{{.Spec.UpdateConfig}}'`,see:[9,3,'Rolling updates and rollbacks']},
 {id:'task',x:21,y:136,w:194,h:56,c:'proc',t:'Replace tasks',s:'stop old, start new',d:'Tasks are replaced in batches.',why:'Order can be start-first.',chk:`docker service ps web`,see:[9,2,'Services']},
 {id:'hc',x:243,y:136,w:194,h:56,c:'mem',t:'Health check',s:'ready',d:'A new task must become healthy before the next batch.',why:'Without it, ready means started.',chk:`docker service ps web --format '{{.CurrentState}}'`,see:[2,7,'Health checks']},
 {id:'rb',x:465,y:136,w:194,h:56,c:'warn',t:'Rollback',s:'on failure',d:'`--update-failure-action rollback` or a manual `docker service rollback` returns to the previous spec.',why:'Automatic rollback is safer.',chk:`docker service rollback web`,see:[9,3,'Rolling updates and rollbacks']}],
 steps:[
 {ids:['upd','par'],t:'1. Start the update with a batch size and delay.',w:'Limits the blast radius.',s:'Update config.',x:'Parallelism equal to replicas.',c:`docker service update --update-parallelism 1 --update-delay 10s web`},
 {ids:['task','hc'],t:'2. Each batch is replaced and must pass health.',w:'Capacity stays up.',s:'Health check.',x:'Unhealthy new tasks.',c:`docker service ps web`},
 {ids:['rb'],t:'3. On failure, the service rolls back.',w:'Automatic return.',s:'Failure action.',x:'Failure action set to pause.',c:`docker service rollback web`}]}},

{h:'4. Hardening a container'},
{map:{title:'Hardening map',h:216,trace:'Reduce what a container can do',
 hint:'Tap any box, or press Reduce what a container can do to follow the hardening steps.',
 lines:[[326,52,352,52],'M454 80 L454 107 L118 107 L118 134',[215,164,241,164],[437,164,463,164]],
 nodes:[
 {id:'base',x:126,y:24,w:200,h:56,c:'disk',t:'Minimal base image',s:'small and pinned',d:'Use a slim or distroless base, pinned by digest, built from multi-stage.',why:'Fewer packages, fewer CVEs.',chk:`docker image ls app`,see:[8,6,'Minimal and hardened base images']},
 {id:'usr',x:354,y:24,w:200,h:56,c:'proc',t:'Non-root user',s:'USER',d:'Create and switch to an unprivileged user in the image.',why:'Root in a container is risky.',chk:`docker run --rm app:1.0 id`,see:[8,1,'Non-root users and the USER instruction']},
 {id:'cap',x:21,y:136,w:194,h:56,c:'warn',t:'Drop capabilities',s:'cap-drop ALL',d:'Remove all Linux capabilities and add back only what is needed.',why:'Avoid --privileged.',chk:`docker run --cap-drop ALL --cap-add NET_BIND_SERVICE app:1.0`,see:[8,2,'Capabilities, seccomp, AppArmor and SELinux']},
 {id:'fs',x:243,y:136,w:194,h:56,c:'disk',t:'Read-only filesystem',s:'--read-only',d:'Make the root filesystem read-only with tmpfs for writable paths.',why:'Stops tampering.',chk:`docker run --read-only --tmpfs /tmp app:1.0`,see:[8,2,'Capabilities, seccomp, AppArmor and SELinux']},
 {id:'sec',x:465,y:136,w:194,h:56,c:'mem',t:'Secrets',s:'not in image',d:'Provide secrets at run time as files or secrets, never in layers or environment history.',why:'Rotate them.',chk:`docker run --mount type=secret,source=db,target=/run/secrets/db app:1.0`,see:[8,4,'Secrets and sensitive data']}],
 steps:[
 {ids:['base','usr'],t:'1. Build from a minimal pinned base and run as non-root.',w:'Two big wins.',s:'Dockerfile.',x:'Root by default.',c:`docker run --rm app:1.0 id`},
 {ids:['cap','fs'],t:'2. Drop capabilities and make the filesystem read-only.',w:'Limits an attacker.',s:'Run flags.',x:'Breaks apps that write.',c:`docker inspect app --format '{{.HostConfig.CapDrop}}'`},
 {ids:['sec'],t:'3. Inject secrets at runtime and scan the final image.',w:'Close the loop.',s:'Secrets.',x:'Secrets in ENV.',c:`docker scout cves app:1.0`}]}},

]},

{t:'Commands by task',d:'The Docker commands used most, grouped by what you want to do.',see:[[2,0,'Anatomy of docker run'],[2,2,'Inspecting containers: ps, inspect, logs, top and stats']],b:[
{t:[['Task','Command'],['Run in background','`docker run -d --name web -p 8080:80 nginx:1.27`'],['List containers','`docker ps -a`'],['Logs','`docker logs -f --tail 100 web`'],['Shell in a container','`docker exec -it web sh`'],['Inspect a field','`docker inspect web --format \'{{.State.Status}}\'`'],['Live resource use','`docker stats --no-stream`'],['Copy files','`docker cp web:/etc/nginx/nginx.conf .`'],['Stop and remove','`docker rm -f web`'],['Images','`docker images`, `docker image prune`, `docker history <image>`'],['Build','`docker build -t app:1.0 .`, `docker buildx build --platform linux/amd64,linux/arm64 .`'],['Networks and volumes','`docker network ls`, `docker volume ls`'],['Disk use and cleanup','`docker system df`, `docker system prune`'],['Compose','`docker compose up -d`, `docker compose logs -f`, `docker compose down`'],['Swarm','`docker service ls`, `docker service ps <svc>`, `docker node ls`']]}
]},
{t:'Files, ports and paths',d:'Where Docker keeps its configuration and data, and the ports it uses.',see:[[1,4,'The daemon and daemon.json'],[6,0,'The writable layer and why data disappears']],b:[
{t:[['Item','Location or value','Note'],['Daemon configuration','`/etc/docker/daemon.json`','Restart or reload the daemon after edits'],['Data root','`/var/lib/docker`','Images, containers and volumes'],['Volumes','`/var/lib/docker/volumes`','Do not edit by hand'],['Daemon socket','`/var/run/docker.sock`','Access equals root'],['Daemon TLS port','2376/TCP','2375 is unencrypted, avoid'],['Swarm management','2377/TCP','Managers only'],['Swarm node gossip','7946 TCP and UDP','Between all nodes'],['Swarm overlay','4789/UDP','VXLAN data traffic'],['User configuration','`~/.docker/config.json`','Registry credentials and contexts'],['Daemon log','`journalctl -u docker`','systemd hosts']]}
]},
{t:'Troubleshooting lookup',d:'Symptom, likely cause and first command for common Docker problems.',see:[[10,3,'A container that will not start: exit codes and OOMKilled'],[10,5,'Troubleshooting networking and DNS']],b:[
{t:[['Symptom','Likely cause','First command'],['Exited immediately','Main process ended, wrong command or config','`docker logs`, `docker inspect` exit code'],['Exit code 137','OOM killed or SIGKILL','`docker inspect` OOMKilled'],['Port already allocated','Another process uses the host port','`ss -ltnp`'],['Cannot connect to the Docker daemon','Daemon down or no permission','`systemctl status docker`, `id`'],['No space left on device','Images, volumes or logs fill the disk','`docker system df`'],['Cannot resolve another container','Default bridge, or different network','`docker network inspect`'],['pull access denied','Not logged in or wrong name','`docker login`, check the image name'],['Data lost after recreate','No volume','`docker diff`, add a volume'],['Build is slow','Cache invalidated, large context','`docker build --progress=plain`'],['exec format error','Wrong architecture','`docker image inspect` Architecture']]}
]},
{t:'Dockerfile and Compose keys',d:'Instructions and keys with what they do and what to watch for.',see:[[4,0,'Dockerfile basics: FROM, RUN, COPY, ADD and WORKDIR'],[7,1,'compose.yaml: services, networks and volumes']],b:[
{t:[['Instruction','Purpose','Watch for'],['`FROM`','Base image','Pin the version or digest'],['`RUN`','Run a command at build time','Combine commands, clean caches'],['`COPY`','Copy from context or stage','Prefer over ADD'],['`ENV` and `ARG`','Runtime and build values','Never for secrets'],['`USER`','Run as a user','Use a non-root user'],['`EXPOSE`','Document a port','Does not publish'],['`HEALTHCHECK`','Define health','Needs curl or similar in the image'],['`ENTRYPOINT` and `CMD`','Start command','Use exec form']]},
{t:[['Compose key','Purpose'],['`services`','Containers of the application'],['`depends_on`','Order, with health conditions'],['`ports`','Published ports'],['`volumes`','Mounts and named volumes'],['`networks`','Custom networks'],['`restart`','Restart policy'],['`healthcheck`','Health test'],['`profiles`','Optional services']]}
]},
]};
