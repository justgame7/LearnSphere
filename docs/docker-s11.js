/* LearnSphere - Docker, Section 11: Logging, Monitoring & Troubleshooting.
   Lectures 0-7 are core, 8-13 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;

/* ---------- diagrams ---------- */
const logs=K.dg(700,200,[
[10,70,130,56,'App writes to|stdout / stderr',0],[190,60,150,76,'Docker logging driver|json-file, local,|journald, syslog, fluentd...',2],[400,20,140,50,'Local files|docker logs works',0],[400,80,140,50,'Remote system|Fluentd, Splunk, CloudWatch',0],[400,140,140,50,'none|logs discarded',0],[590,70,100,56,'You: docker|logs / dashboard',0]],
[[140,98,190,98],[340,85,400,45],[340,98,400,105],[340,115,400,165],[540,45,590,90],[540,105,590,98]]);

/* ---------- 0: container logs and drivers ---------- */
L['docker:10:0']={blocks:[
{p:'A containerized application should write its logs to **standard output (stdout) and standard error (stderr)**, not to files inside the container. Docker captures those streams and hands them to a **logging driver**, which decides where the logs go.'},
{svg:logs},
{h:'Common drivers'},
{t:[['Driver','Where logs go','`docker logs` works?','Notes'],
['`json-file` (default)','JSON files on the host','Yes','**No rotation by default**: can fill the disk'],
['`local`','Compact binary files on the host','Yes','Rotates by default (recommended local choice)'],
['`journald`','systemd journal','Yes','Use `journalctl CONTAINER_NAME=web`'],
['`syslog`','A syslog server','No (without dual logging)','Central logging'],
['`fluentd`, `gelf`, `splunk`','Remote collectors','No','Needs the collector to be reachable'],
['`awslogs`, `gcplogs`','Cloud logging services','No','Credentials and region needed'],
['`none`','Nowhere','No','Disable logging']]},
{note:'With a remote driver `docker logs` shows nothing unless **dual logging** keeps a local copy. Recent Docker versions do keep a local cache for remote drivers by default.'},
{h:'See what you use'},
{code:`docker info --format '{{.LoggingDriver}}'                   # daemon default
docker inspect -f '{{.HostConfig.LogConfig}}' web            # this container
docker inspect -f '{{.LogPath}}' web                         # path of the json-file log
ls -lh /var/lib/docker/containers/*/*-json.log               # sizes of log files (Linux)`},
{h:'Rotation: stop logs filling the disk'},
{p:'The `json-file` driver keeps **everything** unless you limit it. A noisy container can fill the disk in hours.'},
{code:`# One container
docker run -d --name web \\
  --log-driver json-file \\
  --log-opt max-size=10m --log-opt max-file=3 \\
  nginx

# Switch to the local driver for one container
docker run -d --log-driver local --log-opt max-size=10m nginx`},
{code:`// /etc/docker/daemon.json : default for all NEW containers (restart Docker; existing containers keep old settings)
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}`},
{h:'Useful docker logs options'},
{code:`docker logs web
docker logs -f --tail 100 web              # follow, last 100 lines
docker logs --since 30m --until 5m web     # a time window
docker logs -t web                         # timestamps
docker compose logs -f --tail 20 web db    # in Compose
docker service logs -f web                 # in Swarm`},
{h:'Blocking versus non-blocking'},
{t:[['Mode','Behaviour'],
['`blocking` (default)','The app waits if the log driver is slow; logs are never lost, but the app can stall'],
['`non-blocking`','Messages go through a memory buffer; if it fills, **old messages are dropped** instead of stalling the app']]},
{code:`docker run -d --log-opt mode=non-blocking --log-opt max-buffer-size=4m nginx`},
{h:'Application logging good practice'},
{ul:['Write to stdout and stderr; **no log files** inside containers.','One line per event, ideally **structured (JSON)** with a timestamp, level and request ID.','Do not log secrets or personal data.','Choose rotation or a remote driver **before** production.','If an app insists on log files, link them to the streams: `ln -sf /dev/stdout /var/log/app/access.log`.']}],
src:[['Logging overview',K.D+'engine/logging/'],['Configure logging drivers',K.D+'engine/logging/configure/'],['local driver',K.D+'engine/logging/drivers/local/'],['docker logs',R+'cli/docker/container/logs/']]};

/* ---------- 1: events ---------- */
L['docker:10:1']={blocks:[
{p:'The Docker daemon records everything that happens as **events**: a container starts, an image is pulled, a network is created, a health check changes. `docker events` shows them live. It is the quickest way to see **what the daemon is doing** and to catch a container that keeps restarting.'},
{code:`docker events                                          # live stream (Ctrl+C to stop)
docker events --since 30m                              # replay the last 30 minutes, then follow
docker events --since 2025-10-09T10:00:00 --until 2025-10-09T11:00:00
docker events --filter type=container --filter event=die
docker events --filter container=web
docker events --format '{{.Time}} {{.Type}} {{.Action}} {{.Actor.Attributes.name}}'`},
{h:'Event types and common actions'},
{t:[['Type','Typical actions'],
['`container`','`create`, `start`, `die`, `kill`, `stop`, `restart`, `oom`, `health_status`, `exec_start`, `destroy`'],
['`image`','`pull`, `push`, `tag`, `delete`, `save`, `load`'],
['`volume`','`create`, `mount`, `unmount`, `destroy`'],
['`network`','`create`, `connect`, `disconnect`, `destroy`'],
['`daemon`','`reload`'],
['`plugin`, `service`, `node`, `secret`, `config`','Swarm and plugin changes']]},
{h:'What a restart loop looks like'},
{code:`$ docker events --filter container=crashy --filter type=container
2025-10-09T10:01:02 container start   crashy (image=alpine)
2025-10-09T10:01:03 container die      crashy (exitCode=1)
2025-10-09T10:01:04 container start   crashy
2025-10-09T10:01:05 container die      crashy (exitCode=1)`},
{h:'Typical questions answered by events'},
{t:[['Question','Event to watch'],
['Why does the container keep restarting?','`die` with `exitCode`, followed by `start`'],
['Was it killed for memory?','`oom` then `die` (exit code 137)'],
['Who removed it?','`kill`, `stop`, `destroy` times (and your own shell history)'],
['Did a health check change?','`health_status: unhealthy` / `healthy`'],
['Did an image really get pulled?','`image pull`'],
['What happened during a deploy?','A time-window replay with `--since`/`--until`']]},
{h:'Use events in scripts'},
{code:`# Alert whenever any container dies with a non-zero exit code
docker events --filter type=container --filter event=die \\
  --format '{{.Actor.Attributes.name}} exit={{.Actor.Attributes.exitCode}}' \\
  | while read name rest; do
      case "$rest" in exit=0) ;; *) echo "ALERT: $name $rest";; esac
    done`},
{note:'The daemon keeps only a short history of events in memory. For long-term history ship events or container logs to a central system.'},
{h:'Remember'},
{ul:['`docker events` shows **daemon activity**; `docker logs` shows what **applications** printed.','`docker system df` (disk) and `docker stats` (resources) answer different questions and are covered in the next lecture and Section 7.','In Swarm, `docker events` on a manager includes service, node and task changes.']}],
src:[['docker events',R+'cli/docker/system/events/'],['Events API',E+'api/']]};

/* ---------- 2: monitoring ---------- */
L['docker:10:2']={blocks:[
{p:'Monitoring answers: **is it up, how busy is it, and is it getting worse?** Docker gives you a quick built-in view (`docker stats`) and can expose daemon metrics for a monitoring system such as **Prometheus**.'},
{h:'Quick view: docker stats'},
{code:`docker stats                          # live table for running containers
docker stats --no-stream               # one snapshot (good for scripts)
docker stats web db --format "table {{.Name}}\\t{{.CPUPerc}}\\t{{.MemUsage}}\\t{{.MemPerc}}\\t{{.PIDs}}"
docker system df                       # disk used by images, containers, volumes, build cache
docker system df -v`},
{t:[['Signal','What it tells you','Worry when'],
['CPU %','Processor use','Pinned at the limit for long'],
['Memory usage / limit','Use against the cap','Close to the limit (OOM kill soon)'],
['Net I/O','Traffic','Sudden spike or silence'],
['Block I/O','Disk reads/writes','Constant heavy writes'],
['PIDs','Process count','Growing without bound (leak or fork problem)']]},
{h:'Daemon metrics for Prometheus'},
{p:'The daemon can serve its **own metrics** (engine health, container counts by state, image pull times, builds) in Prometheus format on an HTTP port.'},
{code:`// /etc/docker/daemon.json
{
  "metrics-addr": "127.0.0.1:9323"
}
// older Docker versions also required: "experimental": true

sudo systemctl restart docker
curl -s http://127.0.0.1:9323/metrics | head
# engine_daemon_container_states_containers{state="running"} 5
# engine_daemon_engine_info{...} 1`},
{note:'Bind the metrics endpoint to **localhost** or a private interface. It has no authentication.'},
{code:`# prometheus.yml (scrape the daemon)
scrape_configs:
  - job_name: docker
    static_configs:
      - targets: ["host.example:9323"]`},
{h:'Per-container metrics'},
{t:[['Tool','What it gives'],
['`docker stats`','Live numbers on the host, no history'],
['**cAdvisor**','A container (or agent) that exports per-container CPU, memory, network and disk metrics to Prometheus'],
['**Prometheus + Grafana**','Collect, store, graph and alert (Additional content)'],
['Cloud monitoring agents','Datadog, CloudWatch, Azure Monitor and others read the Docker API']]},
{code:`docker run -d --name cadvisor -p 127.0.0.1:8080:8080 \\
  -v /:/rootfs:ro -v /var/run:/var/run:ro -v /sys:/sys:ro -v /var/lib/docker/:/var/lib/docker:ro \\
  gcr.io/cadvisor/cadvisor:latest`},
{h:'Health and liveness'},
{ul:['Add a **health check** to every service; monitoring can read `docker inspect` health status or the Engine API.','Alert on **symptoms users feel** (error rate, latency, restarts), not only on CPU.','Alert on **disk usage** of the Docker data root: full disks stop containers.']},
{flow:['Define what good looks like (health checks, limits)','Collect metrics (daemon, containers, host)','Graph them and set alerts on restarts, OOM kills, disk and memory','Keep logs centrally so you can correlate','Review after every incident']},
{code:`# Things worth alerting on (from Docker data)
docker events --filter event=oom --filter event=die
docker ps --filter health=unhealthy
docker ps --filter status=restarting
df -h /var/lib/docker`}],
src:[['Collect Docker metrics with Prometheus',K.D+'engine/daemon/prometheus/'],['docker stats',R+'cli/docker/container/stats/'],['docker system df',R+'cli/docker/system/df/']]};

/* ---------- 3: container will not start ---------- */
L['docker:10:3']={blocks:[
{p:'"My container exits immediately" is the most common Docker problem. The cure is a **fixed routine**: read the state, read the logs, read the exit code, then test the command by hand.'},
{h:'The routine'},
{flow:['docker ps -a: is it Exited, Restarting or Created?','docker logs --tail 50 NAME: what was the last thing it said?','docker inspect -f for ExitCode, OOMKilled, Error: why did it stop?','Check the command: docker inspect for Entrypoint and Cmd','Run it by hand with a shell: docker run --rm -it --entrypoint sh IMAGE','Fix, rebuild, retry']},
{code:`docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"
docker logs --tail 50 app
docker inspect -f 'exit={{.State.ExitCode}} oom={{.State.OOMKilled}} err={{.State.Error}} started={{.State.StartedAt}} finished={{.State.FinishedAt}}' app
docker inspect -f 'entrypoint={{.Config.Entrypoint}} cmd={{.Config.Cmd}} user={{.Config.User}} workdir={{.Config.WorkingDir}}' app
docker run --rm -it --entrypoint sh myimage          # explore the image, run the command yourself`},
{h:'Exit codes'},
{t:[['Code','Meaning','Typical cause'],
['0','Finished normally','The main process ended: a one-shot command, or a server running in the background (daemonised)'],
['1','Application error','Read the logs: exception, missing config'],
['125','`docker run` itself failed','Bad flag, port in use, name conflict'],
['126','Command found but cannot run','No execute permission, wrong architecture'],
['127','Command not found','Wrong CMD/ENTRYPOINT, missing binary or shell'],
['137','Killed (SIGKILL)','**Out of memory (OOMKilled)** or `docker kill`'],
['139','Segmentation fault','Crashing binary, wrong library'],
['143','SIGTERM','Stopped normally by `docker stop`']]},
{h:'Frequent causes and fixes'},
{t:[['Symptom in logs or state','Cause','Fix'],
['Container exits at once with code 0','The main process ended, for example `nginx` without `-g "daemon off;"` or `CMD service x start`','Run the program in the **foreground**'],
['`exec format error`','Image built for another CPU architecture (arm64 vs amd64), or a script with no shebang','Build/pull the right `--platform`; add `#!/bin/sh`'],
['`exec: "x": executable file not found in $PATH`','Wrong command or the tool is not in the image (minimal image)','Fix CMD, install the binary'],
['`no such file or directory` for a script that exists','**Windows CRLF line endings** or a missing interpreter','Convert with `dos2unix`; check the shebang'],
['`permission denied`','Script not executable, or non-root user cannot read it','`chmod +x` / `COPY --chmod=755`, fix ownership'],
['OOMKilled=true, exit 137','Memory limit too low or a leak','Raise `-m`, tune the app, check `docker stats`'],
['`address already in use` / `port is already allocated`','Host port taken','Change `-p`, stop the other program'],
['Crashes with missing environment variable','Config not passed','`-e` / `--env-file`, check `docker exec env`'],
['Starts, then dies after N seconds','The app depends on something not ready (database)','Health checks, retry logic, `depends_on` conditions'],
['`Restarting (1)` forever','Crash loop with a restart policy','Read logs; temporarily remove the policy to debug']]},
{h:'Debug the image directly'},
{code:`# 1. Get a shell in the same image (override the entrypoint)
docker run --rm -it --entrypoint sh myimage
# 2. Inside, run the command the container should run
python app.py            # see the real error on your screen

# 3. If the container exists but stopped, look at its filesystem
docker cp app:/app/config.yaml .
docker commit app debug-image && docker run --rm -it --entrypoint sh debug-image`},
{note:'A one-line trick for a container that exits too fast to inspect: start it with a harmless command that keeps it alive, such as `docker run -d --entrypoint sleep myimage 3600`, then `docker exec -it` into it.'}],
src:[['Run reference: exit codes',R+'cli/docker/container/run/#exit-status'],['docker inspect',R+'cli/docker/inspect/']]};

/* ---------- 4: images and builds ---------- */
L['docker:10:4']={blocks:[
{p:'Image problems show up in two places: **pulling** (getting an image) and **building** (making one). Read the **exact error text**; it almost always names the cause.'},
{h:'Pull failures'},
{t:[['Message','Cause','Fix'],
['`pull access denied ... repository does not exist or may require authorization`','Typo, or private image without login','Check the name; `docker login`'],
['`manifest unknown` / `not found`','The tag does not exist','List tags on the registry; fix the tag'],
['`no matching manifest for linux/arm64/v8`','No image for your CPU','Use `--platform linux/amd64` (emulation) or another image'],
['`toomanyrequests: You have reached your pull rate limit`','Docker Hub limit','Log in, use a mirror or your own registry'],
['`x509: certificate signed by unknown authority`','Private CA or proxy inspection','Install the CA (`/etc/docker/certs.d/`) or system trust store'],
['`TLS handshake timeout` / `i/o timeout`','Network, DNS or proxy','Test with `curl`; configure daemon proxy (Section 2)'],
['`no space left on device`','Disk full','`docker system df`, prune (below)']]},
{h:'Build failures'},
{code:`docker build --progress=plain -t app .       # full output of every step (default view hides detail)
docker build --no-cache -t app .             # rule out a stale cache
docker build --target build -t app-debug .   # stop at a stage and inspect it
docker run --rm -it app-debug sh             # look at what that stage contains`},
{t:[['Message','Cause','Fix'],
['`COPY failed: file not found in build context`','File missing, outside the context or in .dockerignore','Check paths and `.dockerignore`'],
['`failed to compute cache key: "/x" not found`','Same as above (BuildKit wording)','Same'],
['`returned a non-zero code: 100` (apt)','`apt-get update` not run, mirror problem','`RUN apt-get update && apt-get install -y ...` in one layer'],
['`pip install` / `npm ci` fails','Missing system library, network, lock file mismatch','Install build deps; check network and proxy'],
['`unable to find user app`','USER before creating the user','Create the user first'],
['`failed to solve: ... : not found` on FROM','Wrong base image name or tag','Fix FROM, `docker pull` it by hand'],
['`the --mount option requires BuildKit`','Old builder','Use BuildKit/buildx and the `# syntax=docker/dockerfile:1` line']]},
{h:'Cache surprises'},
{ul:['**A change is ignored:** an earlier step is cached. A `RUN apt-get update` is cached **by text**, not by what the internet contains. Use `--no-cache` or change a build argument.','**Everything rebuilds every time:** an early `COPY . .` includes a file that changes each build (logs, `.git`). Fix `.dockerignore` and order (Section 5).','**Wrong base image:** `FROM python:3.12` may have moved; pin tags and use `--pull`.']},
{h:'Disk space'},
{code:`docker system df                      # what uses space
docker image prune                    # dangling images
docker image prune -a --filter "until=168h"     # unused images older than 7 days
docker builder prune --filter "until=168h"      # old build cache
docker container prune                # stopped containers
docker volume ls -f dangling=true     # check BEFORE pruning volumes: they may hold data
docker system prune                   # containers, networks, dangling images, cache`},
{note:'`docker system prune --volumes` also deletes unused volumes. Never run it on a host with data you care about unless you reviewed the list.'},
{h:'Image does not behave as expected'},
{code:`docker history image --no-trunc | head       # which instruction created what
docker image inspect -f '{{json .Config}}' image
docker run --rm -it --entrypoint sh image    # explore files
docker buildx imagetools inspect image       # platforms (architectures) available`}],
src:[['Troubleshoot builds',K.B+'building/troubleshoot/'],['Pull rate limits',K.D+'docker-hub/usage/'],['docker system prune',R+'cli/docker/system/prune/']]};

/* ---------- 5: networking and DNS ---------- */
L['docker:10:5']={blocks:[
{p:'Network problems feel mysterious until you check them **one hop at a time**. Start at the application and move outward, and decide at each step: *works* or *broken*.'},
{svg:K.dg(700,150,[
[10,50,120,50,'1 App listens?|0.0.0.0 not 127',0],[160,50,120,50,'2 Same network?|names resolve?',0],[310,50,120,50,'3 Port published?|-p host:container',0],[460,50,110,50,'4 Host firewall|and routing',0],[600,50,90,50,'5 Outside|world',0]],
[[130,75,160,75],[280,75,310,75],[430,75,460,75],[570,75,600,75]])},
{h:'Step 1: is the application listening, and on which address?'},
{code:`docker exec web ss -tlnp               # or: netstat -tln   (install iproute2 if missing)
# LISTEN 0 128 127.0.0.1:8000    <- BAD: only reachable INSIDE the container
# LISTEN 0 128 0.0.0.0:8000      <- GOOD: reachable from the network`},
{note:'The #1 mistake: a server started with `--host 127.0.0.1` (or `localhost`) inside a container. Publishing a port then does nothing. Bind to **0.0.0.0**.'},
{h:'Step 2: can containers reach each other?'},
{code:`docker network ls
docker network inspect app-net --format '{{range .Containers}}{{.Name}} {{.IPv4Address}}{{println}}{{end}}'
docker exec web getent hosts db        # does the name resolve?  (nslookup / dig if installed)
docker exec web curl -sv http://db:5432   # TCP reachable?   (or: nc -zv db 5432)
docker inspect -f '{{json .NetworkSettings.Networks}}' web`},
{ul:['Both containers must be on the **same user-defined network**. The default bridge has **no name resolution**.','Names resolve **inside** Docker only, not from your host shell.','Use the **container port**, not the published host port, between containers.']},
{h:'Step 3: is the port published correctly?'},
{code:`docker port web                          # 8000/tcp -> 0.0.0.0:8080
docker ps --format "{{.Names}} {{.Ports}}"
curl -v http://localhost:8080            # from the host
ss -tlnp | grep 8080                     # does the host listen?`},
{h:'Step 4: host firewall and routing'},
{code:`sudo iptables -t nat -L DOCKER -n | head
sudo iptables -L DOCKER-USER -n          # your own rules may drop traffic
ip route ; ip addr show docker0
sysctl net.ipv4.ip_forward               # must be 1 for container traffic to leave the host`},
{h:'Step 5: DNS to the outside'},
{code:`docker exec web cat /etc/resolv.conf
docker exec web nslookup example.com
docker run --rm busybox nslookup example.com           # does a fresh container resolve?
docker run --rm --dns 1.1.1.1 busybox nslookup example.com`},
{t:[['Symptom','Likely cause'],
['Works by IP, fails by name','Default bridge, or different network, or DNS problem'],
['Name resolves, connection refused','Service not listening, or listening on 127.0.0.1'],
['Name resolves, connection times out','Different networks or a firewall rule'],
['Cannot resolve external names','Host DNS not reachable from containers; set `dns` in daemon.json'],
['Works on the host, not in containers behind a VPN','Subnet clash: change `default-address-pools`'],
['Intermittent slow DNS','`ndots` search domains; use fully qualified names']]},
{h:'A toolbox container'},
{p:'Minimal images lack `curl`, `ping`, `dig`. Attach a **toolbox container** to the same network namespace instead of installing tools in production images.'},
{code:`docker run --rm -it --network container:web nicolaka/netshoot
# inside: ss -tlnp, curl localhost:8000, dig db, tcpdump -i eth0 port 8000`}],
src:[['Networking troubleshooting',K.D+'engine/network/#troubleshooting'],['netshoot','https://github.com/nicolaka/netshoot']]};

/* ---------- 6: daemon troubleshooting ---------- */
L['docker:10:6']={blocks:[
{p:'If `docker ps` says `Cannot connect to the Docker daemon`, the problem is the **daemon**, not your containers. The routine is the same: check the service, read its log, fix the cause.'},
{h:'Is the daemon running?'},
{code:`systemctl status docker --no-pager
systemctl status docker.socket containerd --no-pager
sudo systemctl start docker
docker context ls                        # is the CLI pointing at the right daemon?
echo $DOCKER_HOST                        # a leftover variable can redirect everything
ls -l /var/run/docker.sock`},
{h:'Where the daemon logs are'},
{t:[['Platform','Location'],
['Linux with systemd','`journalctl -u docker -n 100 --no-pager` (follow with `-f`)'],
['Linux without systemd','`/var/log/docker.log` (varies) or syslog'],
['Docker Desktop (Mac)','`~/Library/Containers/com.docker.docker/Data/log/`'],
['Docker Desktop (Windows)','`%LOCALAPPDATA%\\Docker\\log\\` and the Troubleshoot menu'],
['Rootless','`journalctl --user -u docker`']]},
{h:'Debug mode'},
{code:`// /etc/docker/daemon.json
{ "debug": true }

sudo systemctl reload docker             # or: sudo kill -SIGHUP $(pidof dockerd)  (debug can be toggled live)
docker info | grep -i debug
journalctl -u docker -n 100 --no-pager   # now with detailed messages

# Run the daemon in the foreground to see start-up output (stop the service first)
sudo systemctl stop docker docker.socket
sudo dockerd --debug`},
{h:'Common start-up failures'},
{t:[['Log message','Cause','Fix'],
['`unable to configure the Docker daemon with file /etc/docker/daemon.json: invalid character`','JSON syntax error','`sudo dockerd --validate --config-file=/etc/docker/daemon.json`; fix commas and quotes'],
['`the following directives are specified both as a flag and in the configuration file: hosts`','Same option in daemon.json and in the systemd unit','Remove one (systemd drop-in or daemon.json)'],
['`failed to start daemon: ... could not find an available, non-overlapping IPv4 address pool`','No free address range for networks','Set `default-address-pools` to a free range'],
['`Error starting daemon: error initializing graphdriver` / storage driver errors','Corrupt or incompatible storage, wrong file system','Check the file system (overlay2 needs ext4 or xfs with d_type), disk space'],
['`no space left on device`','Disk or inodes full','`df -h`, `df -i`, prune, move data-root'],
['`failed to dial gRPC: ... containerd.sock`','containerd not running','`systemctl status containerd`; restart it'],
['`bridge docker0 ... address already in use` / network conflict','Another interface uses 172.17.0.0/16','Set `bip` in daemon.json'],
['Permission denied on docker.sock','Not in the docker group, socket mode changed','Add user to group (security note, Section 2), check socket permissions']]},
{h:'Check configuration and system'},
{code:`docker info                              # Warnings at the bottom (swap, cgroup, kernel features)
docker system info | grep -E "Cgroup|Storage|Root Dir|Live Restore"
df -h /var/lib/docker ; df -i /var/lib/docker
sudo dockerd --validate --config-file=/etc/docker/daemon.json
dmesg | tail -30                         # kernel messages (OOM kills, file system errors)`},
{h:'Recovery order'},
{flow:['Read journalctl -u docker for the first error','Validate daemon.json and the systemd unit overrides','Free disk space if full; restart containerd then docker','Restore the last working daemon.json (you kept a backup)','If data is damaged, restore from backup; only as a last resort move /var/lib/docker aside to start fresh']},
{note:'Always keep a copy of `daemon.json` before editing and test it with `--validate`. A typo is the number one reason a daemon will not start after maintenance.'}],
src:[['Troubleshoot the Docker daemon',E+'daemon/troubleshoot/'],['Daemon configuration',E+'daemon/'],['Docker Desktop troubleshooting',K.D+'desktop/troubleshoot-and-support/troubleshoot/']]};

/* ---------- 7: practical break/fix ---------- */
L['docker:10:7']={blocks:[
{p:'**Goal:** diagnose and fix seven faults using only the routine from this section. Each scenario gives a **setup** command. Run it, find the cause, fix it, and only then read the answer. Time yourself: aim for 5 minutes each.'},
{h:'Rules of the game'},
{flow:['Run the setup command','Observe: docker ps -a, docker logs, docker inspect','Form a hypothesis from the evidence','Fix it without deleting the scenario setup','Verify with a command that proves it works']},
{h:'Scenario 1: it exits at once'},
{code:`docker run -d --name s1 nginx nginx
docker ps -a --filter name=s1`},
{h:'Scenario 2: nobody can reach it'},
{code:`docker run -d --name s2 -p 8082:8000 python:3.12-slim python -m http.server 8000 --bind 127.0.0.1
curl -m 3 http://localhost:8082 || echo FAIL`},
{h:'Scenario 3: it dies after a while'},
{code:`docker run -d --name s3 -m 20m polinux/stress stress --vm 1 --vm-bytes 100M --vm-hang 0
sleep 5; docker ps -a --filter name=s3`},
{h:'Scenario 4: it cannot find the database'},
{code:`docker run -d --name s4db -e POSTGRES_PASSWORD=pw postgres:16
docker run --rm --name s4app postgres:16 psql -h s4db -U postgres -c "select 1"`},
{h:'Scenario 5: permission denied on its data'},
{code:`mkdir -p /tmp/s5 && sudo chown root:root /tmp/s5 && sudo chmod 755 /tmp/s5
docker run --rm --name s5 --user 1000:1000 -v /tmp/s5:/data alpine sh -c "echo hi > /data/file"`},
{h:'Scenario 6: the build fails'},
{code:`mkdir -p /tmp/s6 && cd /tmp/s6
printf "FROM alpine\\nCOPY app.conf /etc/app.conf\\nCMD [\\"cat\\",\\"/etc/app.conf\\"]\\n" > Dockerfile
echo "setting=1" > app.conf
echo "*.conf" > .dockerignore
docker build -t s6 .`},
{h:'Scenario 7: the daemon will not start'},
{code:`# ONLY on a lab machine you can recover. Keep a backup first.
sudo cp /etc/docker/daemon.json /etc/docker/daemon.json.bak 2>/dev/null || true
echo '{ "log-driver": "local", }' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker ; systemctl is-active docker`},
{h:'Answers'},
{t:[['#','Cause','Evidence','Fix'],
['1','`nginx` daemonises and the container exits with code 0 (command overridden to `nginx`, no foreground flag)','`docker logs` empty, status `Exited (0)`','`docker run -d nginx` (default CMD) or `nginx -g "daemon off;"`'],
['2','The server binds to **127.0.0.1** inside the container','`docker exec s2 python -c ...` / `ss -tln` shows 127.0.0.1:8000','Run with `--bind 0.0.0.0` (or default) and keep `-p 8082:8000`'],
['3','Memory limit 20 MB is lower than the 100 MB the program allocates: **OOMKilled**','`docker inspect -f "{{.State.OOMKilled}} {{.State.ExitCode}}" s3` shows true 137','Raise `-m` or reduce the allocation'],
['4','Containers are on the default bridge: **no name resolution**','`could not translate host name "s4db"`','`docker network create lab`, run both with `--network lab`'],
['5','The bind mount is owned by root; the container runs as uid 1000','`Permission denied`; `ls -ln /tmp/s5` shows owner 0','`chown 1000:1000 /tmp/s5` or use a named volume'],
['6','`.dockerignore` excludes `*.conf`, so `COPY` cannot find it','`COPY failed: file not found in build context`','Remove the pattern or add `!app.conf`'],
['7','Trailing comma makes `daemon.json` invalid JSON','`journalctl -u docker` shows `invalid character`','Remove the comma, run `dockerd --validate`, restart (restore the .bak)']]},
{h:'Cleanup'},
{code:`docker rm -f s1 s2 s3 s4db 2>/dev/null
docker image rm s6 2>/dev/null
rm -rf /tmp/s5 /tmp/s6
sudo mv /etc/docker/daemon.json.bak /etc/docker/daemon.json 2>/dev/null || sudo rm -f /etc/docker/daemon.json
sudo systemctl restart docker`},
{h:'Debrief questions'},
{ul:['Which command gave you the answer fastest in each case? (`logs`, `inspect`, `ps -a`, `journalctl`)','Which fault would a **health check** or **alert** have caught earlier?','Which would have been prevented by a better **Dockerfile** or **Compose file** (pinned ports, networks, limits)?','Write your own runbook: a table of symptom, first command, usual cause.']}],
src:[['Troubleshoot Docker',K.D+'engine/daemon/troubleshoot/'],['docker logs',R+'cli/docker/container/logs/']]};
})();
