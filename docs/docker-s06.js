/* LearnSphere - Docker, Section 06: Networking.
   Lectures 0-7 are core, 8-13 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;
const N=E+'network/';

/* ---------- diagrams ---------- */
const model=K.dg(700,290,[
[10,10,680,270,'Docker host (Linux)',1],
[30,45,150,50,'Container A|eth0 172.17.0.2',0],[200,45,150,50,'Container B|eth0 172.17.0.3',0],[440,45,230,50,'Container C (host network)|uses the host stack',0],
[30,125,320,50,'docker0 bridge (172.17.0.1)|a virtual switch',2],
[30,205,320,50,'Host NAT / iptables (published ports)',0],[440,205,230,50,'Physical NIC eth0|192.168.1.10',0],
[440,125,230,50,'Internet / LAN',0]],
[[105,95,105,125],[275,95,275,125],[190,175,190,205],[350,230,440,230],[555,205,555,175]]);

const fb=K.dg(700,250,[
[10,10,330,230,'Network: front',1],[360,10,330,230,'Network: back (internal)',1],
[30,50,130,50,'proxy|published :8080',2],[190,50,130,50,'app',0],[380,50,130,50,'app',0],[530,50,140,50,'db|no outside access',0],[380,140,130,50,'cache',0],
[30,150,290,60,'Outside world reaches only the proxy',0]],
[[160,75,190,75],[510,75,530,75]]);

/* ---------- 0: networking model ---------- */
L['docker:5:0']={blocks:[
{p:'Every container gets its **own network stack**: its own network interface, IP address, routing table and ports. Docker connects these private stacks to each other and to the outside through **networks**. A network has a **driver** that decides how the connection works.'},
{svg:model},
{h:'The building blocks'},
{t:[['Piece','Meaning'],
['**Network namespace**','A private copy of the Linux network stack for one container'],
['**veth pair**','A virtual cable with two ends: one end inside the container (`eth0`), one end on the host attached to a bridge'],
['**Bridge**','A virtual switch on the host (`docker0` or a custom `br-xxxx`) that joins the host ends of many veth cables'],
['**NAT (iptables or nftables)**','Rewrites addresses so containers can reach the internet and so published ports reach containers']]},
{h:'Built-in network drivers'},
{t:[['Driver','What it does','Use for'],
['**bridge**','Private network on one host, containers talk through a virtual switch (default)','Most single-host applications'],
['**host**','Container shares the host network stack, no isolation','Performance or a service needing many ports'],
['**none**','No networking except loopback','Fully isolated jobs'],
['**overlay**','Spans several hosts (used by Swarm)','Multi-host clusters'],
['**macvlan**','Container gets its own MAC and an address on the physical LAN','Legacy apps that must look like real hosts'],
['**ipvlan**','Like macvlan but shares the host MAC','Environments limiting MAC addresses']]},
{h:'The three networks you always have'},
{code:`docker network ls
# NETWORK ID     NAME      DRIVER    SCOPE
# 3f1c...        bridge    bridge    local     <- default for docker run
# a9d2...        host      host      local
# 7be0...        none      null      local`},
{h:'Look at it yourself'},
{code:`docker run -d --name web nginx
docker network inspect bridge                      # containers attached, subnet, gateway
docker inspect -f '{{.NetworkSettings.IPAddress}}' web
docker exec web ip addr                            # eth0 inside (needs ip tool; try: cat /proc/net/dev)
ip addr show docker0                               # the bridge on the host
ip link | grep veth                                # host ends of the veth cables`},
{h:'How a packet travels'},
{flow:['A container sends a packet from its eth0','It crosses the veth cable to the docker0 bridge','The bridge delivers it to another container on the same network, or hands it to the host','For the internet, iptables masquerades the source address to the host address','Replies are translated back and returned along the same path']},
{h:'Network scope and addresses'},
{ul:['Each bridge network has a **subnet** (for example 172.17.0.0/16 for `docker0`; 172.18.0.0/16 and up for user-defined ones). The pools are set by `default-address-pools` in daemon.json.','Containers get an IP from the subnet automatically (or you pick one with `--ip` on user-defined networks).','**Scope:** `local` networks exist on one host; `swarm` networks span a cluster.']},
{note:'Containers on **different** bridge networks cannot reach each other by default. That isolation is a feature you will use for security.'}],
src:[['Networking overview',N],['Network drivers',N+'drivers/'],['Bridge driver',N+'drivers/bridge/']]};

/* ---------- 1: default vs user-defined bridge ---------- */
L['docker:5:1']={blocks:[
{p:'Docker creates one **default bridge** named `bridge` (the `docker0` interface). You can also create your own **user-defined bridge** networks. They look similar, but user-defined networks are better in almost every way, and you should use them for real work.'},
{t:[['Feature','Default `bridge`','User-defined bridge'],
['Name resolution between containers','**No** (only by IP address)','**Yes**, automatic DNS by container name'],
['Isolation','All containers without a network share it','Only containers you attach can talk'],
['Attach/detach a running container','Must restart','Can connect and disconnect live'],
['Configure per network (subnet, MTU...)','One global setting in daemon.json','Each network has its own settings'],
['Aliases','No','Yes (`--network-alias`)'],
['Legacy `--link`','Needed for names (deprecated)','Not needed']]},
{h:'See the difference'},
{code:`# Default bridge: no names
docker run -d --name a1 alpine sleep 1d
docker run -d --name a2 alpine sleep 1d
docker exec a1 ping -c 1 a2          # ping: bad address 'a2'
docker exec a1 ping -c 1 172.17.0.3  # works by IP only

# User-defined bridge: names work
docker network create lab
docker run -d --name b1 --network lab alpine sleep 1d
docker run -d --name b2 --network lab alpine sleep 1d
docker exec b1 ping -c 1 b2          # works: 64 bytes from 172.18.0.3

docker rm -f a1 a2 b1 b2 && docker network rm lab`},
{h:'Creating networks'},
{code:`docker network create lab                                  # simplest
docker network create \\
  --driver bridge \\
  --subnet 10.50.0.0/24 --gateway 10.50.0.1 \\
  --ip-range 10.50.0.128/25 \\
  -o com.docker.network.bridge.name=br-lab \\
  lab

docker network ls
docker network inspect lab
docker run -d --name db --network lab --ip 10.50.0.10 postgres:16   # fixed IP on a custom subnet
docker network rm lab                                       # only when no containers use it
docker network prune                                        # remove all unused networks`},
{h:'Useful options'},
{t:[['Option','Meaning'],
['`--subnet`, `--gateway`','Choose the address range if the default clashes with your LAN or VPN'],
['`--ip-range`','Limit automatic allocation to part of the subnet'],
['`--internal`','No route to the outside world'],
['`--ipv6`','Enable IPv6 for the network'],
['`-o com.docker.network.driver.mtu=1450`','Set MTU (useful behind tunnels or overlays)'],
['`--label`','Add metadata']]},
{h:'The legacy --link'},
{p:'Older tutorials use `docker run --link db:database ...`. It is **deprecated**. User-defined networks give the same name-based access without it.'},
{h:'Good defaults'},
{ul:['Create **one network per application** (Compose does this for you).','Never put unrelated apps on the same network.','Do not rely on the default `bridge` for anything that needs names.']},
{flow:['Need containers to find each other by name? Create a user-defined bridge','Need to reach one from outside? Publish its port (next lectures)','Need isolation between tiers? Use more than one network']}],
src:[['Bridge network tutorial',N+'tutorials/standalone/'],['Default vs user-defined bridge',N+'drivers/bridge/#differences-between-user-defined-bridges-and-the-default-bridge'],['docker network create',R+'cli/docker/network/create/']]};

/* ---------- 2: DNS and service discovery ---------- */
L['docker:5:2']={blocks:[
{p:'On a user-defined network containers find each other by **name**. This works because Docker runs a small **embedded DNS server** that answers queries from containers. This is **service discovery**: the application only needs the name `db`, not an IP address that changes at every restart.'},
{svg:K.dg(700,190,[
[10,70,150,56,'Container web|asks: db ?',0],[250,60,200,76,'Docker embedded DNS|127.0.0.11|knows names on this network',2],[540,70,150,56,'Container db|172.18.0.3',0]],
[[160,98,250,98],[450,98,540,98]])},
{h:'How it works'},
{flow:['Docker writes nameserver 127.0.0.11 into the container /etc/resolv.conf','The app asks for the name db','The embedded DNS looks up containers on the same user-defined network','It returns the container IP (or several)','Names it does not know are forwarded to the host DNS servers']},
{code:`docker network create lab
docker run -d --name db --network lab postgres:16
docker run --rm --network lab alpine sh -c "cat /etc/resolv.conf; nslookup db"
# nameserver 127.0.0.11
# Name: db   Address: 172.18.0.2`},
{h:'Names you can use'},
{t:[['Name','Source'],
['Container name','`--name db`'],
['Network alias','`--network-alias database` (extra names, per network)'],
['Compose service name','The service key in compose.yaml (automatic alias)'],
['Hostname','`--hostname` sets the container own name; not the one other containers use']]},
{code:`docker run -d --name db1 --network lab --network-alias database postgres:16
docker run -d --name db2 --network lab --network-alias database postgres:16
docker run --rm --network lab alpine nslookup database
# returns BOTH addresses: simple round-robin load distribution`},
{note:'Several containers sharing one alias get **DNS round-robin**: each lookup may return the addresses in a different order. It is simple load spreading, not health-aware load balancing.'},
{h:'Controlling DNS'},
{t:[['Option','Effect'],
['`--dns 10.0.0.2`','Use this DNS server for external names'],
['`--dns-search corp.local`','Add a search domain'],
['`--dns-option ndots:2`','Set resolver options'],
['`--add-host db-old:192.168.1.20`','Add a line to /etc/hosts'],
['`--hostname web1`','Container hostname'],
['`dns` in daemon.json','Default servers for all containers']]},
{code:`docker run --rm --dns 1.1.1.1 --add-host legacy:10.1.2.3 alpine sh -c "cat /etc/resolv.conf /etc/hosts"`},
{h:'Where it does not work'},
{ul:['**Default `bridge`:** no name resolution between containers (use IPs or a user-defined network).','**Containers on different networks:** the name is unknown unless the container is attached to both.','**Host network mode:** the container uses the host resolver.','**Names resolve only inside Docker.** From your laptop shell, `db` means nothing; publish a port and use `localhost`.']},
{h:'Troubleshooting name problems'},
{code:`docker exec web cat /etc/resolv.conf            # is it 127.0.0.11?
docker exec web nslookup db                       # or: getent hosts db
docker network inspect lab                        # is db on THIS network?
docker inspect -f '{{json .NetworkSettings.Networks}}' web`}],
src:[['Container networking and DNS',N+'#dns-services'],['docker run network options',R+'cli/docker/container/run/#network']]};

/* ---------- 3: publishing ports ---------- */
L['docker:5:3']={blocks:[
{p:'A container port is private to its network. To let something **outside** reach it (your browser, another server) you must **publish** the port: Docker forwards a port on the host to a port in the container.'},
{svg:K.dg(700,160,[
[10,50,150,56,'Browser|localhost:8080',0],[230,50,200,56,'Host port 8080|(Docker forwards)',2],[500,50,190,56,'Container nginx|listens on 80',0]],
[[160,78,230,78],[430,78,500,78]])},
{h:'The -p flag'},
{t:[['Form','Meaning'],
['`-p 8080:80`','Host port 8080 to container port 80, on **all** host addresses'],
['`-p 127.0.0.1:8080:80`','Same, but only reachable from the **host itself**'],
['`-p 192.168.1.10:8080:80`','Only on that host IP'],
['`-p 8080:80/udp`','UDP instead of TCP'],
['`-p 80`','Container port 80 to a **random** host port'],
['`-p 8000-8010:8000-8010`','A range of ports'],
['`-P` (capital)','Publish every EXPOSEd port to random host ports']]},
{code:`docker run -d --name web -p 8080:80 nginx
curl http://localhost:8080                  # works
docker port web                              # 80/tcp -> 0.0.0.0:8080
docker ps --format "table {{.Names}}\\t{{.Ports}}"

docker run -d --name db -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=pw postgres:16
# reachable only from this machine, not from the network`},
{note:'**Security rule:** `-p 5432:5432` exposes the database to every network interface of the host. For anything not meant to be public, bind to `127.0.0.1` or do not publish at all and let other containers reach it by name.'},
{h:'EXPOSE is not publishing'},
{t:[['','EXPOSE (Dockerfile)','-p (docker run)'],
['What it does','Documents which port the app uses','Actually opens a path from the host'],
['Effect on traffic','**None**','Forwards traffic'],
['Needed to publish?','No (you can publish unexposed ports)','Yes']]},
{h:'What if the port is taken?'},
{code:`docker run -d -p 8080:80 nginx
# docker: Error response from daemon: ... Bind for 0.0.0.0:8080 failed: port is already allocated
ss -tlnp | grep 8080                         # who uses it?
docker ps --filter publish=8080`},
{h:'Container-to-container traffic needs no publishing'},
{p:'Containers on the same user-defined network reach each other on **any** port using the container name. Publishing is only for traffic from **outside** Docker.'},
{code:`docker network create lab
docker run -d --name api --network lab nginx          # no -p at all
docker run --rm --network lab curlimages/curl http://api   # works`},
{h:'Practical advice'},
{ul:['Publish only entry points (a reverse proxy or web server).','Keep databases, caches and internal APIs unpublished.','Use explicit host ports in production; random ports (`-P`) are for tests.','Behind a firewall: published ports can bypass host firewall rules (lecture 7 explains why).']}],
src:[['Published ports',N+'port-publishing/'],['docker port',R+'cli/docker/container/port/']]};

/* ---------- 4: host and none ---------- */
L['docker:5:4']={blocks:[
{p:'Two special drivers sit at opposite ends: **host** removes network isolation, **none** removes the network altogether.'},
{svg:K.dg(700,200,[
[10,10,330,180,'--network host',1],[360,10,330,180,'--network none',1],
[30,50,290,44,'Container shares the host network stack',2],[30,104,290,44,'Listens directly on host ports (no -p)',0],
[380,50,290,44,'Only a loopback interface (lo)',2],[380,104,290,44,'No traffic in or out',0]],[])},
{h:'Host network'},
{code:`docker run -d --name web --network host nginx
curl http://localhost:80            # nginx listens directly on the host port 80
docker exec web ip addr             # shows the HOST interfaces
docker run --rm --network host alpine netstat -tln`},
{t:[['Pros','Cons'],
['Best network performance (no NAT, no bridge)','No port isolation: a port clash with the host or other containers'],
['No `-p` needed; handy for services needing many or changing ports (for example some media or monitoring tools)','`-p` is **ignored**; container can see all host network interfaces'],
['Can reach services bound to host localhost','Weaker security; name-based discovery between containers does not apply']]},
{ul:['Works fully on **Linux Engine**.','On **Docker Desktop** the container shares the network of the Desktop **VM**, not your laptop, so `localhost` does not behave as on Linux. Recent Desktop versions offer host networking as an optional setting; check the current docs before relying on it.']},
{h:'None network'},
{code:`docker run --rm --network none alpine ip addr      # only lo
docker run --rm --network none alpine ping -c 1 8.8.8.8   # fails: Network is unreachable`},
{p:'Use `none` for containers that must be **fully isolated**: offline data processing, a sandbox for untrusted code, or when you want to attach a custom network setup yourself.'},
{h:'Choosing'},
{t:[['Need','Choose'],
['Normal app with other containers','User-defined bridge'],
['Maximum throughput or very many ports on Linux','`host`'],
['No network at all','`none`'],
['Containers across hosts','`overlay`']]},
{h:'Other special mode: container'},
{code:`docker run -d --name app nginx
docker run --rm --network container:app alpine wget -qO- localhost   # shares app network stack`},
{p:'`--network container:NAME` joins another container network namespace. Sidecar and debugging containers use this pattern (Kubernetes Pods work the same way).'},
{note:'Do not use `--network host` just to avoid learning port publishing. It gives the container direct access to the host network, which weakens isolation.'}],
src:[['Host network driver',N+'drivers/host/'],['None network driver',N+'drivers/none/']]};

/* ---------- 5: multiple networks ---------- */
L['docker:5:5']={blocks:[
{p:'A container can be attached to **more than one network**. This is the basis of good design: put the web tier, application tier and data tier on different networks and let only the containers that need to talk share a network.'},
{svg:fb},
{h:'Commands'},
{t:[['Task','Command'],
['Create','`docker network create back`'],
['Attach at start','`docker run --network back ...` (one at start)'],
['Attach a running container','`docker network connect back app`'],
['Add an alias while connecting','`docker network connect --alias api back app`'],
['Detach','`docker network disconnect back app`'],
['See attachments','`docker network inspect back` or `docker inspect app`'],
['Remove','`docker network rm back`']]},
{code:`docker network create front
docker network create --internal back          # no route to the outside

docker run -d --name db    --network back  -e POSTGRES_PASSWORD=pw postgres:16
docker run -d --name app   --network back  traefik/whoami
docker network connect front app               # app is now on BOTH networks
docker run -d --name proxy --network front -p 8080:80 nginx

docker inspect -f '{{range $n, $v := .NetworkSettings.Networks}}{{$n}} {{end}}' app   # front back`},
{note:'`docker run --network` accepts only one network at start. Attach extra networks afterwards with `docker network connect` (Compose does it for you).'},
{h:'Internal networks'},
{p:'`--internal` creates a network with **no gateway to the outside**. Containers on it can talk to each other but cannot reach the internet, and published ports do not work. Ideal for databases.'},
{code:`docker run --rm --network back alpine ping -c 1 8.8.8.8     # fails: internal
docker run --rm --network back alpine ping -c 1 db           # works`},
{h:'Design patterns'},
{t:[['Pattern','Networks','Result'],
['Front/back','proxy on `front`; app on both; db on `back`','The database cannot be reached from the proxy or outside'],
['Per application','one network per Compose project','Apps cannot see each other'],
['Monitoring','agent attached to many networks','Collects data from all, exposes nothing']]},
{h:'What to check when containers cannot talk'},
{flow:['docker network inspect: are both containers on the SAME network?','Are they on a user-defined network (names work) rather than the default bridge?','Is the target listening inside the container (docker exec ... ss -tln)?','Is the port correct? (the container port, not the published one)','Is the network --internal while you need the internet?']}],
src:[['docker network connect',R+'cli/docker/network/connect/'],['Networking overview',N]]};

/* ---------- 6: packet filtering ---------- */
L['docker:5:6']={blocks:[
{p:'Docker implements published ports with **firewall rules** that it writes itself. Understanding this prevents a very common surprise: **a published port can be reachable from the network even when your host firewall says it is blocked.**'},
{h:'What Docker adds to the firewall (iptables mode)'},
{t:[['Chain','Purpose'],
['`nat` table: `DOCKER`','DNAT rules: traffic to host port 8080 is rewritten to the container address and port'],
['`nat` table: `POSTROUTING`','MASQUERADE: containers reach outside using the host address'],
['`filter` table: `DOCKER`','Allows forwarded traffic to published container ports'],
['`filter` table: `DOCKER-ISOLATION-*`','Keeps different Docker networks apart'],
['`filter` table: **`DOCKER-USER`**','**Your** rules, evaluated before Docker own rules; Docker never overwrites it']]},
{code:`sudo iptables -t nat -L DOCKER -n -v      # DNAT rules for published ports
sudo iptables -L DOCKER-USER -n -v         # your custom rules
sudo iptables -L FORWARD -n -v | head      # DOCKER-USER and DOCKER jumps
sudo nft list ruleset | grep -i docker     # if your system uses nftables`},
{h:'Why published ports bypass ufw and firewalld'},
{flow:['A packet arrives for host port 8080','The PREROUTING NAT rule rewrites the destination to the container (172.18.0.2:80)','The packet is now FORWARDED, not delivered to the host itself','Host firewalls like ufw mostly filter the INPUT chain (host-bound traffic)','Docker FORWARD rules accept it, so it reaches the container']},
{note:'Result: `ufw deny 8080` does **not** block a Docker published port. Rules for the INPUT chain do not see forwarded traffic.'},
{h:'How to restrict exposure'},
{t:[['Method','How','Notes'],
['**Do not publish**','Leave the port unpublished','Best: other containers use names'],
['**Bind to localhost**','`-p 127.0.0.1:8080:80`','Only the host can connect; put a reverse proxy in front'],
['**Bind to one interface**','`-p 10.0.0.5:8080:80`','Only that address'],
['**DOCKER-USER rules**','Add your drop or allow rules there','Applies to forwarded Docker traffic'],
['**Internal networks**','`--internal`','No outside access at all'],
['**Cloud security group**','Block at the network edge','Always recommended as a second layer']]},
{h:'A DOCKER-USER example'},
{code:`# Allow only the office network 203.0.113.0/24 to reach published ports through eth0
sudo iptables -I DOCKER-USER -i eth0 ! -s 203.0.113.0/24 -j DROP

# Allow only established replies for outbound-initiated flows first (keep these above the DROP):
sudo iptables -I DOCKER-USER -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

sudo iptables -L DOCKER-USER -n --line-numbers
# Make rules persistent with your distribution tool (iptables-persistent, firewalld direct rules, ...)`},
{ul:['Rules in DOCKER-USER see the destination **after** DNAT, so match the container address and port, or use `-m conntrack --ctorigdstport` to match the original host port.','Be careful with DROP rules: test from a second session so you do not cut yourself off.','Docker recreates its own chains at restart but leaves DOCKER-USER alone.']},
{h:'Disabling Docker iptables management'},
{p:'The daemon option `"iptables": false` stops Docker from writing rules. It breaks published ports and outbound NAT unless you write all rules yourself, so it is rarely used. A newer **nftables backend** is available as an experimental option (see Additional content).'},
{h:'Checklist'},
{ul:['List what is published: `docker ps --format "{{.Names}} {{.Ports}}"`.','Anything showing `0.0.0.0:` or `[::]:` is open on every interface.','Use `ss -tlnp` and an external port scan to confirm what the world sees.','Combine bind-to-localhost, DOCKER-USER rules and a cloud firewall.']}],
src:[['Docker and iptables',K.D+'engine/network/packet-filtering-firewalls/'],['Docker with ufw',K.D+'engine/network/packet-filtering-firewalls/#docker-and-ufw'],['Port publishing and mapping',N+'port-publishing/']]};

/* ---------- 7: practical ---------- */
L['docker:5:7']={blocks:[
{p:'**Goal:** build a small three-tier application with correct network separation: a **proxy** reachable from outside, an **app**, and a **database** and **cache** that are private. Then prove the isolation.'},
{svg:fb},
{flow:['Create front and back networks (back is internal)','Start db and cache on back','Start the app on back and connect it to front','Start the proxy on front and publish only its port','Test the working path','Prove what is NOT reachable','Clean up']},
{h:'Step 1: networks'},
{code:`docker network create front
docker network create --internal back
docker network ls | grep -E "front|back"`},
{h:'Step 2: private tier'},
{code:`docker run -d --name db    --network back -e POSTGRES_PASSWORD=pw postgres:16
docker run -d --name cache --network back redis:7
docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"     # no ports published`},
{h:'Step 3: the app on both networks'},
{code:`docker run -d --name app --network back traefik/whoami
docker network connect front app
docker inspect -f '{{range $n, $v := .NetworkSettings.Networks}}{{$n}} {{end}}' app`},
{h:'Step 4: the proxy'},
{code:`cat > default.conf <<'EOF'
server {
  listen 80;
  location / { proxy_pass http://app:80; }
}
EOF
docker run -d --name proxy --network front -p 8080:80 \\
  -v $PWD/default.conf:/etc/nginx/conf.d/default.conf:ro nginx:1.27
curl http://localhost:8080          # response from the whoami container (shows its hostname and IPs)`},
{h:'Step 5: prove the isolation'},
{code:`# 1. The proxy cannot see the database (different network)
docker exec proxy getent hosts db || echo "proxy cannot resolve db  (good)"

# 2. The app CAN reach db and cache by name
docker exec app getent hosts db cache 2>/dev/null || docker run --rm --network back alpine nslookup db

# 3. The database is not reachable from the host
nc -zv localhost 5432 || echo "5432 closed on the host  (good)"

# 4. The back network has no internet
docker run --rm --network back alpine ping -c 1 -W 2 8.8.8.8 || echo "no outside route  (good)"

# 5. Only one published port exists
docker ps --format "{{.Names}} -> {{.Ports}}"`},
{h:'Checkpoints'},
{t:[['Test','Expected'],
['`curl localhost:8080`','Works through proxy to app'],
['proxy resolves `db`','Fails'],
['app resolves `db` and `cache`','Works'],
['`nc localhost 5432`','Connection refused or no route'],
['ping 8.8.8.8 from `back`','Fails (internal)'],
['Published ports','Only proxy 8080']]},
{h:'Cleanup'},
{code:`docker rm -f proxy app db cache
docker network rm front back
rm default.conf`},
{h:'Stretch goals'},
{ul:['Change the proxy publish to `127.0.0.1:8080:80` and test from another machine.','Add a second app container with the same alias and watch DNS round-robin.','Write the same layout as a Compose file in Section 8.']}],
src:[['Networking tutorials',N+'tutorials/'],['docker network create',R+'cli/docker/network/create/']]};
})();
