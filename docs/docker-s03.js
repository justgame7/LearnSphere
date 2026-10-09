/* LearnSphere - Docker, Section 03: Running & Managing Containers.
   Lectures 0-8 are core, 9-12 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;

/* ---------- diagrams ---------- */
const states=K.dg(700,250,[
[10,100,100,50,'Created',0],[190,100,120,50,'Running',2],[190,15,120,44,'Paused',0],[390,100,120,50,'Exited',0],[580,100,100,50,'Removed',0],
[190,190,120,44,'Restarting',0]],
[[110,125,190,125],[310,125,390,125],[510,125,580,125],[235,100,235,59],[265,59,265,100],[235,150,235,190],[265,190,265,150]]);

const flags=K.dg(700,170,[
[10,60,110,50,'docker run',2],[150,60,120,50,'OPTIONS|-d -p -e -v --name',0],[300,60,110,50,'IMAGE|nginx:1.27',2],[440,60,130,50,'COMMAND + ARGS|(optional)',0],[600,60,90,50,'Process|starts',0]],
[[120,85,150,85],[270,85,300,85],[410,85,440,85],[570,85,600,85]]);

const hc=K.dg(700,190,[
[10,70,120,50,'starting',0],[200,70,120,50,'healthy',2],[390,70,120,50,'unhealthy',0],[560,70,130,50,'You decide:|alert / restart',0]],
[[130,95,200,95],[320,95,390,95],[510,95,560,95],[390,125,320,125]]);

/* ---------- 0: Anatomy of docker run ---------- */
L['docker:2:0']={blocks:[
{p:'`docker run` is the command you will use most. It is really **several commands in one**: it pulls the image if needed, creates a container, sets up networking and storage, and starts the main process.'},
{svg:flags},
{code:`docker run [OPTIONS] IMAGE [COMMAND] [ARG...]

docker run --name web -d -p 8080:80 nginx:1.27
#          ^name    ^detached ^publish port  ^image:tag`},
{h:'What happens, step by step'},
{flow:['Resolve the image name (registry, repository, tag)','Pull it if it is not stored locally','Create the container with a new writable layer on top of the image','Attach networking (default bridge network) and any mounts','Start the main process (the image default command, or yours)','Stream output or return the container ID']},
{note:'Key rule: **a container lives exactly as long as its main process (PID 1).** When that process exits, the container stops.'},
{h:'Three ways to run'},
{t:[['Mode','Flags','Behaviour','Use for'],
['Foreground','(none)','Your terminal shows the output; Ctrl+C stops it','Quick tests'],
['Detached','`-d`','Runs in the background; prints the container ID','Servers and services'],
['Interactive','`-it`','Attaches your keyboard and a terminal (TTY) to the process','Shells, debugging']]},
{code:`docker run --rm alpine echo "hello"          # runs, prints, container is removed
docker run -d --name web -p 8080:80 nginx     # server in the background
docker run -it --rm ubuntu bash               # a shell inside a fresh Ubuntu
curl http://localhost:8080                    # test the server`},
{h:'The options you will use daily'},
{t:[['Option','Meaning','Example'],
['`--name`','Give the container a readable name (otherwise a random one)','`--name db`'],
['`-d`','Detached (background)','`-d`'],
['`-it`','Interactive plus terminal','`-it ubuntu bash`'],
['`--rm`','Delete the container when it exits','`--rm`'],
['`-p`','Publish a port: `host:container`','`-p 8080:80`'],
['`-e`','Set an environment variable','`-e POSTGRES_PASSWORD=secret`'],
['`-v`','Mount a volume or folder','`-v data:/var/lib/postgresql/data`'],
['`--network`','Attach to a network','`--network lab`'],
['`--restart`','Restart policy','`--restart unless-stopped`'],
['`-m`, `--cpus`','Memory and CPU limits','`-m 256m --cpus 1`'],
['`-w`, `-u`','Working directory and user','`-w /app -u 1000`'],
['`--entrypoint`','Replace the image entrypoint','`--entrypoint sh`']]},
{h:'Image and command'},
{p:'The text after the image name is the **command**. If you give one, it replaces the image default command (CMD).'},
{code:`docker run --rm alpine                    # default command; exits at once
docker run --rm alpine ls /               # lists the root folder, then exits
docker run --rm alpine cat /etc/os-release
docker run --rm python:3.12-slim python -c "print(2+2)"`},
{h:'Useful facts'},
{ul:['Every `docker run` makes a **new container**. Use `docker start` to restart an old one.','Names must be unique. Reusing a name gives `Conflict. The container name is already in use`; remove or rename the old one.','Without a tag Docker uses `latest`. Prefer an explicit tag in real work.','Ports are not reachable from outside unless you publish them with `-p`.']},
{h:'Common mistakes'},
{t:[['Mistake','Result','Fix'],
['Running a shell image without `-it`','Exits immediately','Add `-it`'],
['Forgetting `--rm` in experiments','Hundreds of stopped containers','Add `--rm` or use `docker container prune`'],
['Expecting changes to survive','Data gone after `docker rm`','Use volumes (Section 7)'],
['Using the same host port twice','`port is already allocated`','Choose another host port']]}],
src:[['docker run reference',R+'cli/docker/container/run/'],['Running containers',E+'containers/run/']]};

/* ---------- 1: Lifecycle and states ---------- */
L['docker:2:1']={blocks:[
{p:'A container moves through **states** during its life. Knowing the states and the commands that change them explains almost every `docker ps` output.'},
{svg:states},
{h:'The states'},
{t:[['State','Meaning','How you get there'],
['**created**','Exists but never started','`docker create` or a failed `docker run`'],
['**running**','Main process is alive','`docker start` or `docker run`'],
['**paused**','Processes frozen (cgroup freezer); memory is kept','`docker pause`'],
['**restarting**','Docker is restarting it after a failure','A restart policy at work'],
['**exited**','Main process ended (see exit code)','Process finished, `docker stop`, a crash'],
['**dead**','Removal failed; cannot be used','Rare; remove manually'],
['removed','Gone; its writable layer is deleted','`docker rm`']]},
{h:'The commands'},
{t:[['Command','Effect'],
['`docker create IMAGE`','Make a container without starting it'],
['`docker start NAME`','Start a created or exited container (same container, same layer)'],
['`docker stop NAME`','Ask the process to stop: SIGTERM, wait 10 s, then SIGKILL'],
['`docker kill NAME`','Send SIGKILL at once (or another signal with `-s`)'],
['`docker restart NAME`','Stop then start'],
['`docker pause` / `unpause`','Freeze or resume all processes'],
['`docker rm NAME`','Remove a stopped container; `-f` also stops a running one'],
['`docker container prune`','Remove all stopped containers']]},
{h:'Stop versus kill'},
{flow:['docker stop sends SIGTERM to PID 1','The program has 10 seconds (default) to shut down cleanly','If it is still alive, Docker sends SIGKILL','The container moves to exited']},
{p:'A well-behaved server catches SIGTERM, finishes its work and exits. `docker kill` skips that politeness. Change the grace period with `docker stop -t 30 NAME`.'},
{h:'Exit codes tell the story'},
{code:`docker ps -a --format "table {{.Names}}\\t{{.Status}}"
# web    Exited (0) 2 minutes ago      <- normal exit
# job    Exited (1) 1 minute ago       <- the program failed
# app    Exited (137) 3 minutes ago    <- killed (SIGKILL, often out of memory)
# tool   Exited (143) 10 seconds ago   <- stopped by SIGTERM`},
{t:[['Exit code','Usual meaning'],
['0','Finished successfully'],
['1','Application error'],
['125','The `docker run` command itself failed'],
['126 / 127','Command found but not executable / command not found'],
['137','128 + 9: SIGKILL (manual kill, or out of memory)'],
['143','128 + 15: SIGTERM']]},
{h:'Try the whole lifecycle'},
{code:`docker create --name life nginx          # created
docker ps -a --filter name=life
docker start life                        # running
docker pause life                        # paused
docker unpause life
docker stop life                         # exited (0 or 143)
docker start life                        # same container again
docker rm -f life                        # removed`},
{note:'`docker start` reuses the same container and its writable layer. `docker run` always creates a **new** container.'}],
src:[['Container lifecycle (docker container)',R+'cli/docker/container/'],['docker stop',R+'cli/docker/container/stop/']]};

/* ---------- 2: Inspecting containers ---------- */
L['docker:2:2']={blocks:[
{p:'Five commands answer almost every "what is this container doing?" question. Learn what each one is for.'},
{t:[['Question','Command'],
['Which containers exist and what state are they in?','`docker ps`'],
['What is the full configuration and status?','`docker inspect`'],
['What did it print?','`docker logs`'],
['What processes are inside?','`docker top`'],
['How much CPU and memory is it using?','`docker stats`']]},
{h:'docker ps: list containers'},
{code:`docker ps                       # running only
docker ps -a                    # all, including stopped
docker ps -q                    # only IDs (handy for scripts)
docker ps -l                    # the latest created
docker ps --filter status=exited --filter name=web
docker ps --filter "label=app=shop"
docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"
docker ps -s                    # add size of writable layer`},
{h:'docker inspect: the full detail'},
{p:'`inspect` prints a big JSON document. Use `--format` with a Go template to pick out one field.'},
{code:`docker inspect web | less
docker inspect -f '{{.State.Status}}' web
docker inspect -f '{{.State.ExitCode}} {{.State.OOMKilled}}' web
docker inspect -f '{{.NetworkSettings.IPAddress}}' web
docker inspect -f '{{json .Config.Env}}' web
docker inspect -f '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' web
docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' web`},
{t:[['Section of the JSON','What you find'],
['`State`','Status, PID, exit code, OOMKilled, StartedAt, Health'],
['`Config`','Image, command, entrypoint, environment, labels'],
['`HostConfig`','Limits, restart policy, port bindings'],
['`NetworkSettings`','IP addresses, networks, ports'],
['`Mounts`','Volumes and bind mounts']]},
{h:'docker logs: what the container printed'},
{p:'Docker records everything the main process writes to **stdout and stderr**. Applications in containers should log there instead of to files.'},
{code:`docker logs web
docker logs -f web                  # follow (like tail -f); Ctrl+C to leave
docker logs --tail 50 web           # last 50 lines
docker logs --since 10m web         # last 10 minutes
docker logs -t web                  # add timestamps
docker logs --until 2025-01-01T10:00:00 web`},
{h:'docker top and docker stats'},
{code:`docker top web                      # processes of this container (as the host sees them)
docker top web -o pid,user,%cpu,cmd

docker stats                        # live table for all running containers
docker stats --no-stream            # one snapshot
docker stats web db --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}"`},
{t:[['stats column','Meaning'],
['CPU %','Share of host CPU used; can exceed 100 on several cores'],
['MEM USAGE / LIMIT','Memory used against the limit (limit is host total if none set)'],
['NET I/O','Bytes received and sent'],
['BLOCK I/O','Bytes read and written to disk'],
['PIDS','Number of processes and threads']]},
{h:'A short investigation recipe'},
{flow:['docker ps -a: is it running, restarting or exited?','docker logs --tail 100: what was the last thing it said?','docker inspect -f State: exit code and OOMKilled?','docker stats: is it short of CPU or memory?','docker exec: look inside (next lecture)']},
{ul:['Container name or the first few characters of the ID both work in every command.','`docker events` shows a live stream of daemon activity; useful when a container keeps restarting.']}],
src:[['docker ps',R+'cli/docker/container/ls/'],['docker inspect',R+'cli/docker/inspect/'],['docker logs',R+'cli/docker/container/logs/'],['docker stats',R+'cli/docker/container/stats/']]};

/* ---------- 3: exec, attach, cp ---------- */
L['docker:2:3']={blocks:[
{p:'Sometimes you must look **inside** a running container: check a file, run a tool, or fix a problem. Three commands do this, and they are often confused.'},
{t:[['Command','What it does','Creates new process?','Typical use'],
['`docker exec`','Runs a **new** command inside a running container','Yes','Debugging, one-off tasks'],
['`docker attach`','Connects your terminal to the **main** process (PID 1) input and output','No','Interactive main process'],
['`docker cp`','Copies files between host and container','No','Get logs or configs out, push files in'],
['`docker run`','Creates a **new** container','Yes (new container)','Start fresh']]},
{h:'docker exec'},
{code:`docker exec web ls /usr/share/nginx/html          # run one command, see output
docker exec -it web sh                              # open a shell (use bash if installed)
docker exec -u root -it web sh                      # as a different user
docker exec -w /etc/nginx web cat nginx.conf        # set working directory
docker exec -e DEBUG=1 web env | grep DEBUG         # extra environment for this command
docker exec -d web touch /tmp/started               # run in background`},
{ul:['The container must be **running**. For a stopped container use `docker cp` or `docker run` with the same image.','Typing `exit` in an exec shell leaves only that shell; the container keeps running.','Many minimal images have no `bash`, `curl` or `ps`. Use `sh` and install tools temporarily, or use a debug container (Section 11).']},
{h:'docker attach'},
{p:'`attach` shows the output of the **main process** and sends your keystrokes to it. Because it is PID 1, pressing **Ctrl+C** may stop the container.'},
{code:`docker run -dit --name box alpine sh      # -d detached, -it keep stdin and TTY
docker attach box                          # you are now in that same shell
# detach WITHOUT stopping: press Ctrl+P then Ctrl+Q
docker attach --sig-proxy=false box        # Ctrl+C will not be sent to the process
docker attach --detach-keys="ctrl-x" box   # choose your own detach keys`},
{note:'Prefer `docker exec` for looking around. Use `attach` only when you need the real main process input and output.'},
{h:'docker cp'},
{code:`# container -> host
docker cp web:/etc/nginx/nginx.conf ./nginx.conf
docker cp web:/var/log/nginx/. ./logs/

# host -> container
docker cp ./index.html web:/usr/share/nginx/html/index.html

# works on stopped containers too
docker cp job:/app/output.csv .`},
{ul:['Use `-a` to keep file ownership information.','Files copied in are not part of the image. A rebuilt container will not have them. For permanent changes edit the image or use a mounted volume.']},
{h:'Choosing the right tool'},
{flow:['Need to run a quick check inside the container? Use docker exec.','Need the logs? Use docker logs, not attach.','Need a file out or in? Use docker cp.','Need to see the live PID 1 terminal? Use docker attach.']},
{h:'Mini exercise'},
{code:`docker run -d --name web -p 8080:80 nginx
docker exec web nginx -v                              # version
docker exec web sh -c "echo '<h1>Hi</h1>' > /usr/share/nginx/html/index.html"
curl http://localhost:8080                            # shows: Hi
docker cp web:/etc/nginx/conf.d/default.conf .
docker rm -f web`}],
src:[['docker exec',R+'cli/docker/container/exec/'],['docker attach',R+'cli/docker/container/attach/'],['docker cp',R+'cli/docker/container/cp/']]};

/* ---------- 4: Environment variables, entrypoint, command ---------- */
L['docker:2:4']={blocks:[
{p:'The same image can behave differently in different places because you can change its **configuration at run time** without rebuilding. Two tools do this: environment variables and command overrides.'},
{h:'Environment variables'},
{p:'An **environment variable** is a named value (`NAME=value`) that a program can read when it starts. It is the standard way to pass settings such as ports, modes and database addresses.'},
{code:`docker run --rm -e GREETING=Hello alpine sh -c 'echo $GREETING'    # Hello

# Pass a variable from your current shell (value not typed on the command line)
export DB_HOST=db.internal
docker run --rm -e DB_HOST alpine env | grep DB_HOST

# Read many variables from a file
cat app.env
# DB_HOST=db.internal
# LOG_LEVEL=info
docker run --rm --env-file app.env alpine env`},
{ul:['`--env-file` lines are `KEY=value`, no quotes, no `export`. Lines starting with `#` are comments.','Run `docker exec web env` to see what a container actually received.','Environment variables are visible in `docker inspect`. Do not put real secrets there (Section 9 explains alternatives).']},
{h:'Where values can come from'},
{t:[['Source','Example','Priority'],
['Image default','`ENV LOG_LEVEL=warn` in the Dockerfile','Lowest'],
['`--env-file`','`--env-file app.env`','Overrides the image'],
['`-e` flag','`-e LOG_LEVEL=debug`','Highest']]},
{h:'ENTRYPOINT and CMD in one picture'},
{p:'An image defines what to run with two instructions. Together they make the **final command**.'},
{t:[['Part','Role','Overridden by'],
['**ENTRYPOINT**','The program to run (the fixed part)','`--entrypoint`'],
['**CMD**','Default arguments (the changeable part)','Anything after the image name']]},
{t:[['Image defines','You run','Final command'],
['`CMD ["nginx","-g","daemon off;"]`','`docker run img`','`nginx -g "daemon off;"`'],
['same','`docker run img ls`','`ls` (CMD replaced)'],
['`ENTRYPOINT ["ping"]` + `CMD ["localhost"]`','`docker run img`','`ping localhost`'],
['same','`docker run img example.com`','`ping example.com` (CMD replaced)'],
['same','`docker run --entrypoint sh img`','`sh` (ENTRYPOINT replaced)']]},
{code:`docker run --rm alpine ping -c 2 localhost          # command given by you
docker run --rm --entrypoint sh alpine -c "echo hi"  # new entrypoint, arguments after image
docker inspect -f '{{.Config.Entrypoint}} {{.Config.Cmd}}' nginx`},
{note:'Reminder: arguments after the image name go to the entrypoint. In `--entrypoint sh alpine -c "echo hi"`, the `-c "echo hi"` is passed to `sh`.'},
{h:'Other run-time overrides'},
{t:[['Option','Overrides'],
['`-w /app`','Working directory (WORKDIR)'],
['`-u 1000:1000`','User (USER)'],
['`--hostname web1`','Container hostname'],
['`--label env=prod`','Adds metadata labels'],
['`--init`','Runs a tiny init as PID 1 to handle signals and zombies']]},
{h:'Troubleshooting'},
{ul:['A program ignores your variable → check spelling and how the program reads config (some use a config file instead).','Variable value has spaces → quote it for your shell: `-e "MSG=hello world"`.','Wrong command ran → `docker inspect` the container and read Entrypoint and Cmd.']}],
src:[['Set environment variables',E+'containers/run/#environment-variables'],['ENTRYPOINT and CMD',K.D+'reference/dockerfile/#understand-how-cmd-and-entrypoint-interact']]};

/* ---------- 5: Restart policies ---------- */
L['docker:2:5']={blocks:[
{p:'Programs crash and servers reboot. A **restart policy** tells Docker whether to start a container again automatically. It is the simplest form of self-healing on a single host.'},
{t:[['Policy','Restarts when the container...','After daemon or host restart','Typical use'],
['`no` (default)','Never','Stays stopped','Tests, one-off jobs'],
['`on-failure[:N]`','Exits with a non-zero code (up to N times)','Started again if it had failed','Batch jobs that may fail'],
['`always`','Exits for any reason','Started again, even if you stopped it manually earlier','Rarely better than the next'],
['`unless-stopped`','Exits for any reason','Started again, **unless you stopped it by hand**','Long-running services']]},
{code:`docker run -d --name web --restart unless-stopped nginx
docker run -d --name job --restart on-failure:3 myjob:1.0

# Change a policy on an existing container
docker update --restart unless-stopped web

# See the policy and how many restarts happened
docker inspect -f '{{.HostConfig.RestartPolicy.Name}} restarts={{.RestartCount}}' web`},
{h:'Rules to remember'},
{ul:['A restart happens only if the container ran for **at least 10 seconds**. Containers that die at once stay stopped, so Docker does not loop forever on a broken start.','Between restarts Docker waits, doubling the delay each time (starting at 100 ms, up to one minute).','If you run `docker stop`, the container stays stopped (except `always`, which comes back after the daemon restarts).','Restart policies do not apply to a container you removed.']},
{h:'always vs unless-stopped'},
{flow:['You stop a container by hand: docker stop web','The server reboots or dockerd restarts','always: the container starts again','unless-stopped: the container stays stopped, because you stopped it on purpose']},
{h:'Start containers automatically after a reboot'},
{ul:['Make sure the Docker service is enabled at boot (`systemctl enable docker`).','Give each long-running container `--restart unless-stopped`.','Use `live-restore` if you want containers to keep running during daemon restarts.']},
{code:`# Try it
docker run -d --name crashy --restart on-failure:3 alpine sh -c "sleep 15; exit 1"
docker ps -a --filter name=crashy
docker inspect -f '{{.RestartCount}} {{.State.Status}}' crashy
docker rm -f crashy`},
{h:'Restart policy vs health checks'},
{p:'A restart policy reacts to the process **exiting**. It does not notice a container that is running but stuck. Health checks (lecture 8) detect that situation. Plain Docker does not restart an unhealthy container; Swarm and external tools can.'},
{h:'In Compose and Swarm'},
{t:[['Tool','Setting'],
['Compose','`restart: unless-stopped` on the service'],
['Swarm','`deploy.restart_policy` (condition `any`, `on-failure`, `none`)']]}],
src:[['Restart policies',E+'containers/start-containers-automatically/'],['docker update',R+'cli/docker/container/update/']]};

/* ---------- 6: Resource constraints ---------- */
L['docker:2:6']={blocks:[
{p:'By default a container may use **all** the CPU and memory of the host. One busy container can then starve the others. Resource constraints tell the kernel (through cgroups) to put a ceiling on each container.'},
{h:'Memory'},
{t:[['Flag','Meaning','Example'],
['`-m`, `--memory`','Hard limit. Over it, the kernel kills the process (OOM kill)','`-m 512m`'],
['`--memory-reservation`','Soft limit: a target applied when the host is short of memory','`--memory-reservation 256m`'],
['`--memory-swap`','Memory plus swap total. Equal to `-m` means no swap','`--memory-swap 512m`'],
['`--oom-kill-disable`','Do not kill on OOM (dangerous without a limit)','avoid']]},
{code:`docker run -d --name app -m 256m --memory-swap 256m nginx
docker stats --no-stream app                    # shows MEM USAGE / 256MiB
docker inspect -f '{{.State.OOMKilled}} {{.State.ExitCode}}' app

# Provoke an OOM kill on purpose (stress image used as a demo)
docker run --rm -m 50m polinux/stress stress --vm 1 --vm-bytes 200M --timeout 5s
echo $?     # 137 means the process was killed`},
{h:'CPU'},
{t:[['Flag','Meaning','Example'],
['`--cpus`','Hard cap in CPUs. 1.5 = one and a half cores','`--cpus 1.5`'],
['`--cpu-shares`','Relative weight when CPUs are busy (default 1024). Only matters under contention','`--cpu-shares 512`'],
['`--cpuset-cpus`','Pin to specific cores','`--cpuset-cpus 0,2`']]},
{code:`docker run -d --name worker --cpus 0.5 --cpu-shares 512 busybox sh -c "while true; do :; done"
docker stats --no-stream worker     # CPU % stays near 50
docker rm -f worker`},
{ul:['`--cpus` is a **limit**: the container never exceeds it.','`--cpu-shares` is a **weight**: it divides CPU only when there is competition. An idle host lets a container use more.']},
{h:'Number of processes'},
{code:`docker run --rm --pids-limit 100 alpine sh -c "echo limited"
# Protects against fork bombs: a container cannot create unlimited processes`},
{h:'Change limits of a running container'},
{code:`docker update --memory 512m --memory-swap 512m --cpus 1 app`},
{h:'How to read what you see'},
{flow:['Container is killed with exit 137 and OOMKilled=true: it hit the memory limit. Raise the limit or fix the leak.','Container is slow and CPU % sits at its cap: CPU-bound. Raise --cpus or scale out.','Several containers fight: set --cpu-shares or --cpus so important ones win.','docker stats shows a limit equal to total host memory: no limit was set.']},
{note:'Always set memory limits for production containers. Without one, a single leak can make the Linux OOM killer choose any process on the host, including Docker.'},
{h:'Sizing tips'},
{ul:['Measure first with `docker stats` under realistic load, then add headroom.','Language runtimes (Java, Node.js) may need flags to respect container limits; recent versions detect cgroup limits automatically.','On Docker Desktop, limits cannot exceed what the Desktop VM has.']},
{h:'In Compose'},
{code:`services:
  app:
    image: myapp:1.0
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 256M`}],
src:[['Resource constraints',E+'containers/resource_constraints/'],['docker update',R+'cli/docker/container/update/']]};

/* ---------- 7: Health checks ---------- */
L['docker:2:7']={blocks:[
{p:'A container can be **running** but **not working**: a web server stuck in a deadlock still has a live process. A **health check** is a small command Docker runs regularly to ask: "are you actually OK?"'},
{svg:hc},
{h:'How it works'},
{flow:['Docker runs the health command inside the container every interval','Exit code 0 means healthy; exit code 1 means unhealthy','After the number of retries fails in a row, status becomes unhealthy','One success makes it healthy again']},
{t:[['Status','Meaning'],
['`starting`','Within the start period; failures do not count yet'],
['`healthy`','The check is passing'],
['`unhealthy`','The check failed the configured number of times in a row']]},
{h:'Define it in a Dockerfile'},
{code:`HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost/ || exit 1`},
{h:'Or at run time'},
{code:`docker run -d --name web \\
  --health-cmd "curl -f http://localhost/ || exit 1" \\
  --health-interval 10s --health-timeout 3s --health-retries 3 --health-start-period 5s \\
  nginx

docker ps                      # STATUS shows (health: starting), then (healthy)
docker inspect -f '{{.State.Health.Status}}' web
docker inspect -f '{{json .State.Health}}' web | head -c 600    # last results and output`},
{t:[['Option','Default','Meaning'],
['`--health-interval`','30s','Time between checks'],
['`--health-timeout`','30s','A check taking longer counts as failed'],
['`--health-retries`','3','Consecutive failures before unhealthy'],
['`--health-start-period`','0s','Grace time for slow startup'],
['`--no-healthcheck`','','Disable a check defined by the image']]},
{h:'Writing good checks'},
{ul:['Test what matters: an HTTP endpoint (`/health`) or a lightweight query (`pg_isready` for PostgreSQL, `redis-cli ping` for Redis).','Keep it **fast and cheap**; it runs forever. Do not run a heavy query every few seconds.','The tool must exist **in the image**. Minimal images may lack `curl`; use `wget -q --spider` or a built-in command.','Return exit code 0 or 1. Other codes have special meaning and should not be used.']},
{code:`# Examples of useful health commands
pg_isready -U postgres
redis-cli ping
wget -q --spider http://localhost:8080/health
test -f /tmp/ready`},
{h:'What Docker does with the result'},
{ul:['Plain `docker run`: **only records the status**. The container is not restarted automatically.','Compose can wait for health: `depends_on` with `condition: service_healthy` (Section 8).','Swarm replaces unhealthy tasks automatically (Section 10).','Monitoring and load balancers can read the status from `docker inspect` or the Engine API.']},
{note:'A health check that is too strict (short timeout, few retries) can mark a busy but fine container as unhealthy. Tune it from real behaviour.'}],
src:[['HEALTHCHECK instruction',K.D+'reference/dockerfile/#healthcheck'],['docker run health options',R+'cli/docker/container/run/#health-cmd']]};

/* ---------- 8: Practical ---------- */
L['docker:2:8']={blocks:[
{p:'**Goal:** run a small two-container application by hand and use everything from this section: run options, inspect, logs, exec, cp, limits, restart policy and health check. Try to do each step yourself before reading the commands.'},
{h:'Plan'},
{flow:['Create a private network','Start a Redis cache with limits, a restart policy and a health check','Start an nginx web server with a published port','Prove they work (ps, logs, exec, stats)','Break something and watch recovery','Clean up']},
{h:'Step 1: network (preview of Section 6)'},
{code:`docker network create lab
# containers on a user-defined network can find each other by NAME`},
{h:'Step 2: the cache'},
{code:`docker run -d --name cache --network lab \\
  --restart unless-stopped -m 128m --cpus 0.5 \\
  --health-cmd "redis-cli ping" --health-interval 5s --health-retries 3 \\
  redis:7

docker ps --filter name=cache        # wait for (healthy)
docker exec cache redis-cli set greeting "hello docker"
docker exec cache redis-cli get greeting`},
{h:'Step 3: the web server'},
{code:`docker run -d --name web --network lab -p 8080:80 \\
  --restart unless-stopped -m 64m nginx:1.27

curl -I http://localhost:8080        # HTTP/1.1 200 OK
docker exec web sh -c "echo '<h1>Lab is up</h1>' > /usr/share/nginx/html/index.html"
curl http://localhost:8080`},
{h:'Step 4: prove the connection'},
{code:`# A throwaway container on the same network asks the cache by name
docker run --rm --network lab redis:7 redis-cli -h cache get greeting    # hello docker`},
{h:'Step 5: inspect everything'},
{code:`docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
docker logs --tail 5 web
docker stats --no-stream
docker inspect -f '{{.HostConfig.Memory}} bytes, policy={{.HostConfig.RestartPolicy.Name}}' cache
docker cp web:/etc/nginx/conf.d/default.conf ./default.conf`},
{h:'Step 6: break it and recover'},
{code:`docker kill cache                      # simulate a crash (SIGKILL)
docker ps -a --filter name=cache       # what state is it in?
docker inspect -f '{{.RestartCount}}' cache

docker stop web                        # a manual stop with unless-stopped stays stopped
docker start web`},
{note:'After `docker kill`, the policy restarts the container, so `cache` returns to running with RestartCount 1. After your manual `docker stop`, `web` stays stopped until you start it.'},
{h:'Checkpoints'},
{t:[['Check','Expected'],
['`docker ps` shows both containers','cache is `healthy`, web is `Up`'],
['`curl localhost:8080`','Shows the custom page'],
['Redis get from another container','`hello docker`'],
['After `docker kill cache`','Back to running (restart policy)'],
['`docker stats`','Memory limits visible in MEM USAGE / LIMIT']]},
{h:'Cleanup'},
{code:`docker rm -f web cache
docker network rm lab
rm default.conf
docker ps -a                           # should be empty of lab containers`},
{h:'Stretch goals'},
{ul:['Give `cache` a limit of 10 MB and watch what Redis does when it fills.','Replace the health check with one that fails and watch the status change to unhealthy.','Write the same setup as one `docker run` per line in a shell script, then compare it with a Compose file in Section 8.']}],
src:[['docker run reference',R+'cli/docker/container/run/'],['Docker get started',K.D+'get-started/']]};
})();
