/* LearnSphere - Docker, Section 10: Docker Swarm & Orchestration.
   Lectures 0-10 are core, 11-15 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;
const SW=E+'swarm/';

/* ---------- diagrams ---------- */
const arch=K.dg(700,300,[
[10,10,680,120,'Managers (control plane, Raft quorum)',1],[10,150,680,140,'Workers (run the tasks)',1],
[30,45,190,60,'manager 1 (leader)|API, scheduler,|Raft log',2],[255,45,190,60,'manager 2|replica of the log',0],[480,45,190,60,'manager 3|replica of the log',0],
[30,185,190,80,'worker 1|web.1  web.4',0],[255,185,190,80,'worker 2|web.2  db.1',0],[480,185,190,80,'worker 3|web.3  cache.1',0]],
[[220,75,255,75],[445,75,480,75],[125,105,125,185],[350,105,350,185],[575,105,575,185]]);

const svc=K.dg(700,170,[
[10,60,150,56,'Service web|replicas: 4|image: nginx',2],[230,60,150,56,'Tasks|web.1 web.2|web.3 web.4',0],[450,60,150,56,'Containers|one per task|on some node',0]],
[[160,88,230,88],[380,88,450,88]]);

const mesh=K.dg(700,260,[
[10,100,120,56,'Client|node2:8080',0],
[190,30,500,220,'Ingress overlay network (routing mesh)',1],
[210,60,130,56,'node1|:8080 open|no task here',0],[390,60,130,56,'node2|:8080 open|task web.2',0],[540,60,130,56,'node3|:8080 open|task web.1',2],
[300,150,260,60,'Any node forwards to a healthy task|(load balanced, VIP)',2]],
[[130,128,390,116],[275,116,360,150],[455,116,455,150],[600,116,520,150]]);

/* ---------- 0: why orchestration ---------- */
L['docker:9:0']={blocks:[
{p:'Docker Compose runs containers on **one machine**. If that machine fails, everything stops. An **orchestrator** manages containers across **many machines**: it decides where each container runs, restarts failed ones, spreads load, updates without downtime and keeps secrets safe. Docker has one built in: **Swarm mode**.'},
{h:'What an orchestrator adds'},
{t:[['Need','Single host (Compose)','Orchestrator (Swarm)'],
['Survive a machine failure','No','Yes, tasks are rescheduled on other nodes'],
['Scale a service','Manual','`docker service scale web=10`'],
['Rolling updates and rollbacks','Limited','Built in'],
['Load balancing','External','Built-in routing mesh and virtual IPs'],
['Secrets distribution','Files on the host','Encrypted secrets sent only to nodes that need them'],
['Desired state','Re-run the command','Continuously reconciled']]},
{h:'Swarm architecture'},
{svg:arch},
{h:'Vocabulary'},
{t:[['Term','Meaning'],
['**Swarm**','A cluster of Docker Engines running in swarm mode'],
['**Node**','One Docker Engine in the swarm'],
['**Manager node**','Accepts commands, keeps the cluster state (Raft), schedules tasks. One is the **leader**'],
['**Worker node**','Runs tasks assigned by managers (managers can also run tasks)'],
['**Service**','The **desired state**: which image, how many replicas, ports, update rules'],
['**Task**','One unit of work: a container plus the information to run it. Tasks are assigned to nodes and never move; if one fails a **new** task replaces it'],
['**Stack**','A group of services deployed from one Compose file'],
['**Routing mesh**','Makes a published port reachable on **every** node']]},
{svg:svc},
{h:'The control loop'},
{flow:['You declare a service: 4 replicas of nginx','The manager stores this desired state in the Raft log','The scheduler creates 4 tasks and assigns them to nodes','Each node starts the container for its task','If a container or a node dies, the manager creates a replacement task so the actual state matches the desired state']},
{h:'Swarm mode versus the older "Classic Swarm"'},
{p:'"Swarm mode" is built into Docker Engine (`docker swarm`, `docker service`). The separate "Docker Classic Swarm" project is obsolete. This course always means **swarm mode**.'},
{h:'Where Swarm fits'},
{ul:['Easy to learn: uses Docker CLI and Compose files; no extra software.','Good for small to medium clusters and teams that want simplicity.','Kubernetes is far more popular and feature-rich, but also more complex (compare in Section 12).']}],
src:[['Swarm mode overview',SW],['Key concepts',SW+'key-concepts/'],['How swarm mode works',SW+'how-swarm-mode-works/nodes/']]};

/* ---------- 1: init, join, manage nodes ---------- */
L['docker:9:1']={blocks:[
{p:'Turning one Docker host into a swarm takes a single command. Adding more machines takes one more per node.'},
{h:'Ports to open between nodes'},
{t:[['Port','Protocol','Purpose'],
['2377','TCP','Cluster management (manager communication)'],
['7946','TCP and UDP','Node-to-node discovery and gossip'],
['4789','UDP','Overlay network traffic (VXLAN)']]},
{note:'Also allow IP protocol **ESP (50)** between nodes if you use encrypted overlay networks. Never expose 2377 to the internet.'},
{h:'Create the swarm'},
{code:`# On the first machine (it becomes a manager and leader)
docker swarm init --advertise-addr 192.168.56.10
# Swarm initialized: current node (xyz) is now a manager.
# To add a worker to this swarm, run the following command:
#     docker swarm join --token SWMTKN-1-... 192.168.56.10:2377

docker info | grep -A3 Swarm       # Swarm: active, NodeID, Is Manager: true
docker node ls`},
{p:'`--advertise-addr` is the address **other nodes** use to reach this manager. On a machine with several network interfaces you **must** set it.'},
{h:'Join nodes'},
{code:`# Show the join command again at any time
docker swarm join-token worker
docker swarm join-token manager

# On each new machine
docker swarm join --token SWMTKN-1-... 192.168.56.10:2377

# Back on a manager
docker node ls
# ID     HOSTNAME  STATUS  AVAILABILITY  MANAGER STATUS
# abc *  node1     Ready   Active        Leader
# def    node2     Ready   Active
# ghi    node3     Ready   Active`},
{t:[['Token','Joins as'],
['`join-token worker`','A worker'],
['`join-token manager`','A manager (it can control the cluster, keep it secret)']]},
{code:`docker swarm join-token --rotate worker      # invalidate the old token (if it leaked)`},
{h:'Manage nodes'},
{t:[['Task','Command'],
['List nodes','`docker node ls`'],
['Inspect one','`docker node inspect --pretty node2`'],
['Promote a worker','`docker node promote node2`'],
['Demote a manager','`docker node demote node2`'],
['Add a label','`docker node update --label-add disk=ssd node2`'],
['Set availability','`docker node update --availability drain node2`'],
['Remove a node that left','`docker node rm node2`'],
['Leave the swarm (on that node)','`docker swarm leave` (`--force` for the last manager)']]},
{h:'Availability: active, pause, drain'},
{t:[['Availability','New tasks?','Existing tasks','Use for'],
['`active`','Yes','Stay','Normal'],
['`pause`','No','Stay','Temporarily stop new work'],
['`drain`','No','**Moved to other nodes**','Maintenance, upgrades, decommission']]},
{code:`docker node update --availability drain node3     # tasks leave node3
# ...patch and reboot node3...
docker node update --availability active node3    # it can take tasks again`},
{h:'Labels'},
{p:'Labels describe nodes (`disk=ssd`, `zone=a`, `gpu=true`). Services use them in **placement constraints** (next lecture).'},
{code:`docker node update --label-add zone=a node1
docker node inspect node1 -f '{{.Spec.Labels}}'`}],
src:[['Create a swarm',SW+'swarm-tutorial/create-swarm/'],['docker swarm init',R+'cli/docker/swarm/init/'],['Manage nodes',SW+'manage-nodes/']]};

/* ---------- 2: services ---------- */
L['docker:9:2']={blocks:[
{p:'In a swarm you do not run containers; you create **services**. A service says what you want (image, replicas, ports, limits) and the swarm makes it so.'},
{h:'Create and look'},
{code:`docker service create --name web --replicas 3 -p 8080:80 nginx:1.27
docker service ls
# ID    NAME  MODE        REPLICAS  IMAGE        PORTS
# a1b2  web   replicated  3/3       nginx:1.27   *:8080->80/tcp

docker service ps web                 # the tasks and the nodes they run on
docker service inspect --pretty web
docker service logs -f web            # logs of all tasks
docker service scale web=6            # change the replica count
docker service rm web`},
{h:'Replicated versus global'},
{t:[['Mode','Meaning','Use for'],
['**replicated** (default)','You choose the number of replicas; the scheduler places them','Web servers, APIs, workers'],
['**global**','Exactly **one task on every node** (also new nodes automatically)','Monitoring agents, log collectors, security agents']]},
{code:`docker service create --name agent --mode global --mount type=bind,src=/var/log,dst=/host-logs,ro myagent
docker service create --name api --replicas 5 myapi:1.0`},
{h:'Placement: choose where tasks run'},
{t:[['Constraint','Meaning'],
['`node.role==worker`','Only on workers'],
['`node.role==manager`','Only on managers'],
['`node.hostname==node2`','One specific node'],
['`node.labels.disk==ssd`','Nodes with the label'],
['`node.labels.zone!=b`','Nodes without that label value'],
['`engine.labels.os==linux`','By engine label']]},
{code:`docker node update --label-add disk=ssd node2
docker service create --name db --constraint node.labels.disk==ssd --constraint node.role==worker postgres:16

# Spread replicas across zones (preference, not a hard rule)
docker service create --name web --replicas 6 --placement-pref spread=node.labels.zone nginx:1.27`},
{note:'A **constraint** is a hard rule: if no node matches, the task stays `Pending` ("no suitable node"). A **preference** is only a hint.'},
{h:'Resources and policies'},
{code:`docker service create --name api --replicas 3 \\
  --limit-cpu 0.5 --limit-memory 256M \\
  --reserve-cpu 0.25 --reserve-memory 128M \\
  --restart-condition on-failure --restart-max-attempts 3 \\
  --env LOG_LEVEL=info \\
  --health-cmd "wget -q --spider http://localhost:8000/health" --health-interval 10s \\
  myapi:1.0`},
{t:[['Option','Meaning'],
['`--limit-*`','Hard cap per task (like `-m`, `--cpus`)'],
['`--reserve-*`','Amount the scheduler **guarantees** when placing the task'],
['`--restart-condition`','`none`, `on-failure`, `any` (default)'],
['`--network`','Attach to an overlay network'],
['`--mount`, `--secret`, `--config`','Storage and sensitive data'],
['`--publish`','Publish through the routing mesh']]},
{h:'Change a service later'},
{code:`docker service update --replicas 8 web
docker service update --image nginx:1.27.2 web          # rolling update (next lecture)
docker service update --env-add MODE=prod --publish-add 8443:443 web
docker service update --constraint-add node.labels.zone==a web`},
{h:'How the scheduler decides (replicated)'},
{flow:['Filter nodes: availability, constraints, platform, resources reserved','Among the remaining nodes prefer the ones with fewer tasks of this service','Apply placement preferences (spread)','Assign the task; the node pulls the image and starts it']}],
src:[['Deploy services',SW+'services/'],['docker service create',R+'cli/docker/service/create/'],['Swarm task states',SW+'how-swarm-mode-works/swarm-task-states/']]};

/* ---------- 3: rolling updates and rollbacks ---------- */
L['docker:9:3']={blocks:[
{p:'Updating a service must not take it down. Swarm replaces tasks **a few at a time** according to rules you set, checks that new tasks are healthy, and can **roll back automatically** if the update fails.'},
{svg:K.dg(700,190,[
[10,30,110,50,'web.1 v1',0],[10,90,110,50,'web.2 v1',0],[10,150,110,30,'web.3 v1',0],
[200,30,150,50,'web.1 v2|replaced first',2],[200,90,110,50,'web.2 v1',0],[200,150,110,30,'web.3 v1',0],
[440,30,110,50,'web.1 v2',2],[440,90,110,50,'web.2 v2',2],[440,150,110,30,'web.3 v1',0],
[580,70,110,60,'finally|all v2',2]],
[[120,55,200,55],[350,55,440,55]])},
{h:'Update the image'},
{code:`docker service update \\
  --image nginx:1.27.2 \\
  --update-parallelism 2 \\
  --update-delay 10s \\
  --update-order start-first \\
  --update-failure-action rollback \\
  --update-monitor 30s \\
  web

docker service ps web                 # shows new tasks and the Shutdown ones
docker service inspect --pretty web | grep -A8 UpdateStatus`},
{t:[['Option','Meaning'],
['`--update-parallelism N`','Replace N tasks at a time (default 1)'],
['`--update-delay 10s`','Pause between batches'],
['`--update-order stop-first|start-first`','Stop the old task before starting the new one (default), or start the new first (no capacity dip, needs spare resources)'],
['`--update-failure-action pause|continue|rollback`','What to do if new tasks fail'],
['`--update-monitor 30s`','How long to watch a new task before judging it healthy'],
['`--update-max-failure-ratio 0.25`','Tolerated fraction of failed tasks']]},
{h:'Health checks make updates safe'},
{p:'If the image defines a **HEALTHCHECK** (or you pass `--health-cmd`), Swarm waits for the new task to become **healthy** before moving on. Without a health check, "running" is enough, so a broken app that starts but fails requests would still be rolled out.'},
{h:'Rollback'},
{code:`docker service rollback web            # return to the previous service definition

# Automatic rollback settings (for failures during the rollback itself)
docker service update --rollback-parallelism 2 --rollback-delay 5s --rollback-failure-action pause web`},
{h:'What an update looks like'},
{flow:['New spec stored: image nginx:1.27.2','Swarm updates the first batch of tasks (parallelism)','It waits for them to be running and healthy for the monitor period','If a task fails and the failure action is rollback, the service returns to the old spec','Otherwise it waits the delay and continues with the next batch']},
{h:'Update strategies compared'},
{t:[['Strategy','Settings','Trade-off'],
['**Careful**','parallelism 1, delay 30s, rollback on failure','Slow, very safe'],
['**Fast**','parallelism 50 percent, delay 0','Quick, bigger blast radius'],
['**No downtime**','`start-first`, health checks','Needs extra capacity during the update']]},
{note:'Tip: set update and rollback behaviour in your **stack file** (`deploy.update_config`, `deploy.rollback_config`) so it is part of your reviewed configuration.'}],
src:[['Apply rolling updates',SW+'swarm-tutorial/rolling-update/'],['docker service update',R+'cli/docker/service/update/'],['docker service rollback',R+'cli/docker/service/rollback/']]};

/* ---------- 4: stacks ---------- */
L['docker:9:4']={blocks:[
{p:'A **stack** is a group of services, networks, volumes, secrets and configs defined in **one Compose file** and deployed to a swarm with one command. It is how you run real applications on Swarm.'},
{code:`# stack.yaml  (a Compose file with a deploy section)
services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
    networks: [front]
    deploy:
      replicas: 4
      update_config:
        parallelism: 2
        delay: 10s
        order: start-first
        failure_action: rollback
      rollback_config:
        parallelism: 1
      restart_policy:
        condition: on-failure
        max_attempts: 3
      resources:
        limits:   { cpus: "0.50", memory: 128M }
        reservations: { cpus: "0.25", memory: 64M }
      placement:
        constraints: [node.role == worker]

  cache:
    image: redis:7
    networks: [front]
    deploy:
      replicas: 1

networks:
  front:
    driver: overlay`},
{code:`docker stack deploy -c stack.yaml shop       # create or update the stack named shop
docker stack ls
docker stack services shop                    # services and replica counts
docker stack ps shop                          # all tasks
docker stack rm shop                          # remove everything
docker stack deploy -c stack.yaml shop        # run it again after editing: it updates what changed`},
{h:'Resources get the stack name as prefix'},
{p:'Services become `shop_web` and `shop_cache`; the network becomes `shop_front`. Containers refer to each other by the **service name** (`cache`), as in Compose.'},
{h:'docker compose up versus docker stack deploy'},
{t:[['','docker compose up','docker stack deploy'],
['Target','One Engine','A swarm (manager)'],
['`build:`','Supported','**Ignored**: images must already be in a registry'],
['`deploy:` section','Mostly ignored (resources honoured)','**Used**: replicas, update, placement, resources, restart_policy'],
['`depends_on`','Orders start-up','**Ignored**'],
['`container_name`, `links`, `restart`, `cap_add`...','Supported','Ignored or not supported (use `deploy` equivalents)'],
['Secrets/configs','Files from the host','Created in the swarm (`external` or file at deploy)'],
['Network driver default','bridge','overlay']]},
{note:'Because `depends_on` is ignored, make your services tolerant of start-up order: retries, health checks and reconnect logic.'},
{h:'Private registries'},
{code:`docker login registry.example.com
docker stack deploy -c stack.yaml --with-registry-auth shop     # send registry credentials to the nodes`},
{h:'Checks before you deploy'},
{code:`docker compose -f stack.yaml config           # validate YAML and interpolation
docker stack config -c stack.yaml            # shows the resolved stack file`},
{h:'Workflow'},
{flow:['Build and push images to a registry (CI)','Write or update the stack file with deploy settings','docker stack deploy on a manager','Watch docker stack ps and docker service logs','Change the image tag in the file and run deploy again for a rolling update']}],
src:[['Deploy a stack',SW+'stack-deploy/'],['docker stack deploy',R+'cli/docker/stack/deploy/'],['Compose deploy specification',K.D+'reference/compose-file/deploy/']]};

/* ---------- 5: overlay networks and routing mesh ---------- */
L['docker:9:5']={blocks:[
{p:'Containers of one service run on different machines. They still need to talk to each other and to the outside world. Swarm solves this with **overlay networks** (for container-to-container traffic) and the **routing mesh** (for traffic from outside).'},
{h:'Overlay networks'},
{p:'An **overlay** network is a virtual network spread over all nodes. Packets between nodes are wrapped in **VXLAN** (UDP 4789). Containers see one flat network and reach each other by service name.'},
{code:`docker network create --driver overlay --attachable backend
docker service create --name db --network backend postgres:16
docker service create --name api --network backend myapi:1.0
# inside api: the name db resolves to the service virtual IP`},
{ul:['Overlay networks are created on a manager and appear on a worker only when a task needs them.','`--attachable` also lets standalone containers (`docker run --network backend`) join, useful for debugging.','Add encryption of data traffic with `-o encrypted` (small performance cost).']},
{h:'Service discovery inside the swarm'},
{t:[['Mode','How it works','Use'],
['**VIP** (default)','A service name resolves to one **virtual IP**; the swarm load-balances to the tasks','Most services'],
['**DNSRR** (`--endpoint-mode dnsrr`)','The name resolves to all task IPs (DNS round-robin)','When clients do their own load balancing, or with host-mode ports']]},
{code:`docker exec <a-task> nslookup api            # one VIP address
docker exec <a-task> nslookup tasks.api      # all task addresses`},
{h:'The routing mesh (ingress)'},
{p:'When you publish a port on a service, **every node** listens on that port, even nodes that run no task of the service. A request to **any node** is forwarded to a healthy task wherever it runs.'},
{svg:mesh},
{code:`docker service create --name web --replicas 2 -p 8080:80 nginx:1.27
curl http://node1:8080     # works even if node1 runs no web task
curl http://node2:8080
curl http://node3:8080`},
{h:'Why it matters'},
{ul:['**Simple:** point a load balancer at any or all nodes on port 8080; it does not need to know where tasks run.','**Resilient:** if a task or node fails, requests continue to other tasks.','**Caveat:** the source IP seen by the application is the ingress network address, not the real client. To keep it, use **host mode** publishing.']},
{h:'Host mode publishing'},
{code:`docker service create --name web --mode global \\
  --publish mode=host,target=80,published=80 nginx:1.27
# Port 80 is opened only on nodes where a task runs; the real client IP is preserved.`},
{t:[['','Ingress (default)','Host mode'],
['Listens on','Every node','Only nodes with a task'],
['Load balancing','Mesh balances across tasks','None built in; you balance externally'],
['Client IP','Hidden (NAT)','Preserved'],
['Typical','Web apps behind a load balancer','Proxies, services needing the client IP']]},
{h:'Troubleshooting networking'},
{ul:['Check ports 2377, 7946 (TCP/UDP) and 4789 (UDP) between nodes.','`docker network inspect backend` shows peers and the services attached.','Overlay MTU problems on cloud networks: set a smaller MTU with `-o com.docker.network.driver.mtu=1450`.']}],
src:[['Overlay networks',E+'network/drivers/overlay/'],['Use swarm mode routing mesh',SW+'ingress/'],['Networking with overlay',E+'network/tutorials/overlay/']]};

/* ---------- 6: secrets and configs ---------- */
L['docker:9:6']={blocks:[
{p:'Swarm has built-in, secure delivery for sensitive data and configuration. A **secret** is stored **encrypted** in the managers Raft log, sent over mutual TLS **only to nodes that run a task needing it**, and mounted in memory (a tmpfs) at `/run/secrets/<name>`. It is never written to the disk of the worker.'},
{t:[['','Secret','Config'],
['Purpose','Passwords, keys, certificates','Non-sensitive config files'],
['Stored','Encrypted in the Raft log','In the Raft log (not encrypted separately)'],
['Mounted at','`/run/secrets/<name>` (in-memory file)','Path you choose (default `/<name>`)'],
['Max size','500 KB','500 KB']]},
{h:'Create and use'},
{code:`# Create from stdin (does not save the value in shell history files)
printf "s3cr3tpw" | docker secret create db_password -
docker secret create tls_key ./server.key
docker secret ls
docker secret inspect db_password         # metadata only, never the value

docker service create --name db \\
  --secret db_password \\
  -e POSTGRES_PASSWORD_FILE=/run/secrets/db_password \\
  postgres:16

docker exec $(docker ps -q -f name=db) cat /run/secrets/db_password`},
{h:'Rename or relocate the mount'},
{code:`docker service create --name api \\
  --secret source=tls_key,target=server.key,uid=1000,gid=1000,mode=0400 \\
  myapi:1.0
# available as /run/secrets/server.key`},
{h:'In a stack file'},
{code:`services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
secrets:
  db_password:
    external: true             # created beforehand with docker secret create
configs:
  nginx_conf:
    file: ./nginx.conf         # created at deploy time`},
{h:'Configs'},
{code:`docker config create nginx_conf ./nginx.conf
docker service create --name web --config source=nginx_conf,target=/etc/nginx/nginx.conf -p 8080:80 nginx:1.27`},
{h:'Secrets and configs are immutable: rotation'},
{p:'You cannot edit a secret. To change one, create a **new** secret with a new name and update the service to swap them.'},
{flow:['docker secret create db_password_v2 -','docker service update --secret-rm db_password --secret-add source=db_password_v2,target=db_password db','The service rolling-updates tasks with the new value','Remove the old secret: docker secret rm db_password']},
{h:'Rules'},
{ul:['Use secrets for sensitive data; **never** environment variables.','A secret is available to **every task of a service that references it**, and to nobody else.','Enable **autolock** (lecture 8) so the Raft keys that protect secrets are not stored unencrypted on disk of the managers.','Remove secrets you no longer use.']}],
src:[['Manage sensitive data with Docker secrets',SW+'secrets/'],['Store configuration data using Docker configs',SW+'configs/']]};

/* ---------- 7: manager HA ---------- */
L['docker:9:7']={blocks:[
{p:'Managers store the swarm state and take decisions. They agree using the **Raft consensus** algorithm: a change is accepted only when a **majority (quorum)** of managers confirms it. If you lose the majority, the swarm **cannot change** (no new services, no scaling, no rescheduling) although running containers keep running.'},
{h:'Quorum arithmetic'},
{t:[['Managers','Majority needed','Failures tolerated'],
['1','1','0'],
['2','2','**0** (worse than 1: two points of failure)'],
['3','2','**1**'],
['4','3','1 (no better than 3)'],
['5','3','**2**'],
['7','4','3 (the recommended maximum)']]},
{note:'Always use an **odd** number of managers: 3 for most clusters, 5 for higher resilience, never more than 7 (more managers slow down consensus). Spread them across failure zones.'},
{svg:K.dg(700,180,[
[10,30,200,60,'3 managers: 1 fails|2 of 3 still a majority|cluster keeps working',2],[250,30,200,60,'3 managers: 2 fail|1 of 3 is NOT a majority|cluster read-only',0],[490,30,200,60,'Workers keep running|tasks, but no changes|can be made',0],
[10,115,680,50,'Recovery: bring managers back, or on the surviving one run: docker swarm init --force-new-cluster',0]],[])},
{h:'Practical advice'},
{ul:['Run managers on **dedicated, stable machines**; keep them off the public internet.','Drain managers (`docker node update --availability drain`) so heavy workloads do not starve them.','Demote and remove a failed manager (`docker node demote`, `docker node rm`) before adding a replacement.','Do not copy a manager VM image: node identities must be unique.']},
{h:'Back up the swarm state'},
{code:`# On a manager (stop Docker for a consistent copy; with 3+ managers the others keep the swarm alive)
sudo systemctl stop docker
sudo tar czf swarm-backup-$(date +%F).tar.gz -C /var/lib/docker swarm
sudo systemctl start docker`},
{p:'The backup contains the Raft data, secrets (encrypted) and certificates. Keep it **secure**. To restore: stop Docker on a manager, empty `/var/lib/docker/swarm`, extract the backup there, start Docker and run `docker swarm init --force-new-cluster` to start from that state, then rejoin the other managers.'},
{h:'Autolock: protect the keys at rest'},
{p:'By default the managers keep the Raft **encryption key** and TLS keys on disk, unencrypted. If someone steals a manager disk, they can read all secrets. **Autolock** keeps that key out of the disk: after a Docker restart a manager stays **locked** until an administrator supplies the **unlock key**.'},
{code:`docker swarm update --autolock=true
# Swarm updated.
# To unlock a swarm manager after it restarts, run: docker swarm unlock
# SWMKEY-1-AbC...   <- SAVE THIS KEY in a password manager, NOT on the same machine

# After a manager restarts
docker node ls                          # Error: Swarm is encrypted and needs to be unlocked
docker swarm unlock                     # paste the unlock key

docker swarm unlock-key                 # show the current key
docker swarm unlock-key --rotate        # create a new key (old one stops working)`},
{note:'If you lose the unlock key **and** all managers restart, you cannot unlock the swarm. Store the key safely and separately.'},
{h:'Checklist'},
{flow:['3 or 5 managers, odd, in separate failure zones','Managers drained of workloads','Regular, tested backups of /var/lib/docker/swarm','Autolock enabled and the unlock key stored safely','A documented procedure for replacing a manager and for quorum loss']}],
src:[['Administer and maintain a swarm',SW+'admin_guide/'],['Lock your swarm',SW+'swarm_manager_locking/'],['Raft in swarm mode',SW+'raft/']]};

/* ---------- 8: storage in swarm ---------- */
L['docker:9:8']={blocks:[
{p:'A swarm moves tasks between nodes, but a normal **local volume** exists on **one node only**. If a database task restarts on another node, it starts with an **empty** volume. Stateful services need a plan.'},
{svg:K.dg(700,190,[
[10,30,200,60,'node1|volume pgdata (has data)|task db.1 runs here',2],[250,30,200,60,'node2|volume pgdata (empty)|task db.1 moves here?',0],[490,30,200,60,'Result|database starts empty|or fails',0],
[10,115,680,60,'Fix: pin the task to the node with the data, OR use shared storage (NFS, cloud volume plugin)',2]],
[[210,60,250,60],[450,60,490,60]])},
{h:'Option 1: keep a local volume and pin the task'},
{code:`docker node update --label-add db=true node1
docker service create --name db \\
  --constraint node.labels.db==true \\
  --mount type=volume,src=pgdata,dst=/var/lib/postgresql/data \\
  -e POSTGRES_PASSWORD_FILE=/run/secrets/db_password --secret db_password \\
  postgres:16`},
{ul:['Simple and fast, but the service is **tied to one node**; if the node dies, the database does not move.','Back up the volume regularly (Section 7).']},
{h:'Option 2: shared storage (NFS)'},
{code:`# Every node can mount the same NFS export
docker service create --name web \\
  --mount 'type=volume,src=media,dst=/data,volume-driver=local,volume-opt=type=nfs,volume-opt=device=:/exports/media,"volume-opt=o=addr=10.0.0.5,rw,nfsvers=4"' \\
  nginx:1.27`},
{code:`# The same in a stack file
volumes:
  media:
    driver: local
    driver_opts:
      type: nfs
      o: "addr=10.0.0.5,rw,nfsvers=4"
      device: ":/exports/media"`},
{h:'Option 3: volume plugins'},
{p:'Volume drivers (plugins) connect to cloud block storage or storage systems (for example REX-Ray, cloud provider drivers, Portworx). The volume can follow the task. Install the plugin on **every node** and use it with `--mount type=volume,volume-driver=...`.'},
{h:'Bind mounts in swarm'},
{ul:['`type=bind` uses a host path that must **exist on every node** that may run the task (the service fails with "no such file" otherwise).','Fine for read-only config or for global services such as log collectors.']},
{h:'Comparison'},
{t:[['Approach','Data moves with task?','Complexity','Typical use'],
['Local volume + constraint','No (pinned)','Low','Small databases, single replica'],
['NFS / shared filesystem','Yes','Medium','Uploads, shared content'],
['Volume plugin (cloud block)','Yes (attach/detach)','Higher','Cloud databases'],
['Managed database outside the swarm','n/a','Low for you','Often the best answer for critical data']]},
{note:'Databases do not like network file systems with weak locking. For critical state consider an external managed database and keep the swarm services **stateless**.'},
{h:'Checks'},
{code:`docker service ps db --no-trunc         # where did the task run, why did it move?
docker volume ls                        # on each node: volumes are per node
docker node ls`}],
src:[['Use volumes in swarm',E+'storage/volumes/#use-a-volume-driver'],['Volume plugins',E+'extend/plugins_volume/']]};

/* ---------- 9: troubleshooting services ---------- */
L['docker:9:9']={blocks:[
{p:'When a service is not working, ask the swarm what **each task** is doing and why. The swarm records an error message for every failed task.'},
{h:'The commands'},
{t:[['Command','Shows'],
['`docker service ls`','Services and `running/desired` replica counts'],
['`docker service ps web`','Tasks, their node, state and **ERROR**'],
['`docker service ps web --no-trunc`','Full error messages'],
['`docker service logs web`','Logs of all tasks (add `-f`, `--tail`, `--timestamps`)'],
['`docker service inspect --pretty web`','The service spec and update status'],
['`docker node ps node2`','All tasks on one node'],
['`docker node ls`','Is a node Down or Drained?'],
['`docker events`','Live events (task and node changes)']]},
{h:'Task states'},
{flow:['new','pending (waiting for a node)','assigned','accepted','preparing (pull image)','starting','running','complete, failed, shutdown, rejected or orphaned']},
{t:[['Stuck in','Meaning','Look at'],
['`pending`','No node satisfies constraints or resources','Constraints, reservations, node availability'],
['`preparing`','Image is being pulled','Registry access, image name, network'],
['`rejected`','A node could not start it (image missing, bad config)','`--no-trunc` error'],
['`failed`','The container exited with an error','`docker service logs`, exit code'],
['`shutdown`','Replaced by an update or scale-down','Normal'],
['`orphaned`','Its node has been down for a long time','Node status']]},
{h:'Common errors and fixes'},
{t:[['Message','Cause and fix'],
['`no suitable node (scheduling constraints not satisfied on N nodes)`','Constraint matches no node: check labels with `docker node inspect` or relax the constraint'],
['`no suitable node (insufficient resources on N nodes)`','Reservations exceed free resources: lower them or add capacity'],
['`No such image: ...` / `pull access denied`','Image not available on the node: push to a registry; use `--with-registry-auth`'],
['`port is already allocated` / `port already in use`','Another service already publishes that port on the mesh'],
['`task: non-zero exit (1)`','The application crashed: read the service logs'],
['`task: non-zero exit (137)`','Out of memory or killed: raise the limit'],
['`starting` then `failed` again and again','Failing health check or crash loop: check logs and the health command'],
['`Error: network not found` on a stack','The overlay network was not created or has another name']]},
{h:'A step-by-step approach'},
{flow:['docker service ls: is it 0/3? 1/3?','docker service ps NAME --no-trunc: which task failed, and what is the ERROR column?','docker service logs NAME: what did the application say?','docker node ls: is a node Down, or Drain?','docker service inspect --pretty NAME: constraints, resources, update status','Reproduce locally with docker run on the same image and settings']},
{code:`docker service ps web --no-trunc --filter desired-state=running
docker service ps web --filter desired-state=shutdown       # past failed tasks and why
docker service logs --since 10m --timestamps web
docker service update --force web                            # redeploy all tasks (fixes stuck state)`},
{note:'To run a one-off debug container on a task node use `docker ps` on that node (tasks are ordinary containers named `service.slot.taskid`) and `docker exec` into it.'}],
src:[['Troubleshoot services',SW+'services/#troubleshoot-a-service'],['docker service ps',R+'cli/docker/service/ps/'],['docker service logs',R+'cli/docker/service/logs/']]};

/* ---------- 10: practical ---------- */
L['docker:9:10']={blocks:[
{p:'**Goal:** build a three-node swarm, deploy a stack, perform a rolling update, drain a node and survive a manager failure. Use three Linux machines or VMs with Docker Engine installed (for example three VMs on one computer, or three cheap cloud servers) named `m1`, `m2`, `m3`.'},
{note:'No spare machines? Use `docker swarm init` on a single host and do steps 2 to 5 and 7. The failure steps (6) need several nodes. Never run this lab on production machines.'},
{flow:['Create the swarm and join nodes','Deploy a stack with replicas and update rules','Check the routing mesh','Perform a rolling update','Drain a node','Make managers fail and recover','Clean up']},
{h:'Step 1: swarm of 3 managers'},
{code:`# on m1
docker swarm init --advertise-addr <m1-ip>
docker swarm join-token manager        # copy the printed command

# on m2 and m3 (paste the join command)
docker swarm join --token SWMTKN-1-... <m1-ip>:2377

# on m1
docker node ls                          # 3 nodes: one Leader, two Reachable`},
{h:'Step 2: deploy the stack'},
{code:`cat > lab.yaml <<'EOF'
services:
  web:
    image: nginx:1.26
    ports: ["8080:80"]
    networks: [lab]
    healthcheck:
      test: ["CMD-SHELL", "curl -fs http://localhost/ || exit 1"]
      interval: 5s
      retries: 3
    deploy:
      replicas: 4
      update_config:
        parallelism: 1
        delay: 5s
        order: start-first
        failure_action: rollback
        monitor: 15s
      resources:
        limits: { memory: 128M }
networks:
  lab:
    driver: overlay
EOF
docker stack deploy -c lab.yaml lab
docker stack services lab
docker stack ps lab                     # 4 tasks spread over m1, m2, m3`},
{h:'Step 3: routing mesh'},
{code:`for h in m1 m2 m3; do curl -sI http://$h:8080 | head -1; done      # all answer, whichever node runs a task`},
{h:'Step 4: rolling update and rollback'},
{code:`docker service update --image nginx:1.27 lab_web
watch -n1 docker service ps lab_web                  # tasks replaced one at a time

# Cause a failing update on purpose
docker service update --image nginx:doesnotexist lab_web
docker service ps lab_web --no-trunc                 # error: No such image
docker service inspect --pretty lab_web | grep -A5 "UpdateStatus"
docker service rollback lab_web                      # or let failure_action: rollback do it`},
{h:'Step 5: drain a node (maintenance)'},
{code:`docker node update --availability drain m3
docker stack ps lab --filter desired-state=running   # tasks left m3 and run elsewhere
curl -sI http://m3:8080 | head -1                    # m3 still answers through the mesh
docker node update --availability active m3`},
{h:'Step 6: manager failure and quorum'},
{code:`# stop Docker on one manager (m3): 2 of 3 managers remain, quorum holds
sudo systemctl stop docker                           # run on m3
docker node ls                                       # (on m1) m3 is Down; the cluster still works
docker service scale lab_web=6                       # works

# stop a second manager (m2): quorum is lost
sudo systemctl stop docker                           # run on m2
docker service scale lab_web=8                       # hangs or errors: no quorum
curl -sI http://m1:8080 | head -1                    # running containers still serve traffic

# recovery: bring a manager back
sudo systemctl start docker                          # on m2
docker node ls`},
{note:'If a majority of managers is permanently lost, the last resort is `docker swarm init --force-new-cluster` on a surviving manager. It creates a new single-manager cluster from the existing state (see Additional content).'},
{h:'Step 7: backup'},
{code:`# on a manager, with the other managers up
sudo systemctl stop docker
sudo tar czf swarm-backup.tar.gz -C /var/lib/docker swarm
sudo systemctl start docker`},
{h:'Checkpoints'},
{t:[['Check','Expected'],
['`docker node ls`','3 managers: 1 Leader, 2 Reachable'],
['Stack tasks','4 running, spread across nodes'],
['Update with bad image','Update paused or rolled back, service still serving'],
['After drain of m3','No tasks on m3; mesh still answers there'],
['1 manager down','Cluster operates'],
['2 managers down','No changes possible; traffic keeps flowing']]},
{h:'Cleanup'},
{code:`docker stack rm lab
# on m2 and m3
docker swarm leave
# on m1
docker swarm leave --force`},
{h:'Stretch goals'},
{ul:['Add a secret and mount it into the web service.','Enable autolock and test unlocking after a restart.','Convert `web` to `--mode global` and add a fourth node.','Add `placement.constraints` that keep the web service off the managers.']}],
src:[['Swarm tutorial',SW+'swarm-tutorial/'],['Administer a swarm',SW+'admin_guide/']]};
})();
