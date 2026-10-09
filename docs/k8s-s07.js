/* LearnSphere - Kubernetes Administrator, Section 07: Services & Networking.
   Lectures 0-7 are core, 8-13 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const N=C+'services-networking/';

const model=K.dg(700,240,[
[10,10,330,220,'Node 1  (Pod CIDR 10.244.1.0/24)',1],[360,10,330,220,'Node 2  (Pod CIDR 10.244.2.0/24)',1],
[30,45,140,50,'Pod A|10.244.1.5',0],[185,45,140,50,'Pod B|10.244.1.6',0],[380,45,140,50,'Pod C|10.244.2.7',2],[535,45,140,50,'Pod D|10.244.2.8',0],
[30,130,295,70,'CNI plugin: veth pairs + routes / overlay|every Pod reaches every Pod without NAT',2],[380,130,295,70,'CNI plugin: veth pairs + routes / overlay|node-to-node path (VXLAN, BGP, cloud routes)',2]],
[[100,95,100,130],[450,95,450,130]]);

const svc=K.dg(700,240,[
[10,90,110,60,'Client Pod',0],
[170,80,160,80,'Service web|ClusterIP 10.96.12.5:80|(virtual, stable)',2],
[390,20,140,50,'Pod 10.244.1.5|ready',0],[390,95,140,50,'Pod 10.244.2.7|ready',0],[390,170,140,50,'Pod 10.244.2.9|not ready (excluded)',0],
[570,80,120,80,'EndpointSlice|ready Pod IPs',2]],
[[120,120,170,120],[330,105,390,45],[330,125,390,120],[530,120,570,120]]);

const ingress=K.dg(700,220,[
[10,80,100,60,'Internet|client',0],
[150,80,150,60,'Load balancer|or NodePort',0],
[340,70,160,80,'Ingress controller|Pods that apply|Ingress rules',2],
[550,10,140,50,'Service api|/api',0],[550,85,140,50,'Service web|/ and web.example.com',0],[550,160,140,50,'Service docs|docs.example.com',0]],
[[110,110,150,110],[300,110,340,110],[500,95,550,35],[500,110,550,110],[500,125,550,185]]);

/* ---------- 0: Networking model ---------- */
L['k8s:6:0']={blocks:[
{p:'Kubernetes networking looks complicated because several different problems share the word "network". Before looking at Services, Ingress or policies, you need the simple rules the cluster guarantees, and a clear picture of **which component solves which problem**. Most networking troubleshooting is just asking "which of the four kinds of traffic is failing?".'},
{h:'The rules of the Kubernetes network model'},
{svg:model},
{ul:['Every **Pod gets its own IP address**, shared by all containers in that Pod.','Any Pod can reach any other Pod **by IP, without NAT**, regardless of which node it runs on.','Agents on a node (the kubelet, system daemons) can reach every Pod on that node.','Pods that use `hostNetwork: true` share the **node IP and ports** instead (used by some system components).']},
{p:'These rules mean an application can treat the cluster like one flat network. But Kubernetes only **defines** the model. The actual wiring (virtual interfaces, routes, tunnels) is done by a **CNI plugin** that you install.'},
{h:'Four kinds of traffic, four solutions'},
{t:[['Traffic','Example','Solved by','Look here when it fails'],
['Container to container (same Pod)','App to its sidecar','Shared network namespace (`localhost`)','Port clashes, wrong port'],
['Pod to Pod','web to api by Pod IP','**CNI plugin** (routes or overlay)','CNI Pods, node routes, MTU, firewall between nodes'],
['Pod to Service','web calls `http://api`','**kube-proxy** rules (or CNI dataplane) and **CoreDNS**','DNS, EndpointSlices, kube-proxy, selectors'],
['External to Service','Browser to your app','NodePort, LoadBalancer, **Ingress** or **Gateway**','Load balancer, ingress controller, TLS, routes']]},
{h:'What a CNI plugin does'},
{p:'When the kubelet creates a Pod sandbox it calls the runtime, which executes the **CNI plugin binary** from `/opt/cni/bin` using the configuration in `/etc/cni/net.d`. The plugin creates a virtual ethernet pair, puts one end inside the Pod network namespace, assigns an IP from the node **Pod CIDR** (IPAM), and programs routes or tunnels so other nodes can reach it.'},
{flow:['The kubelet creates the Pod sandbox via the runtime','The runtime calls the CNI plugin with the sandbox network namespace','The plugin creates a veth pair and assigns an IP from the node Pod CIDR','It programs routes, overlay or BGP so other nodes can reach that IP','The Pod can now send and receive traffic']},
{code:`$ kubectl get nodes -o custom-columns=NAME:.metadata.name,PODCIDR:.spec.podCIDR
NAME      PODCIDR
worker1   10.244.1.0/24
worker2   10.244.2.0/24                          # each node owns a slice of the Pod network

$ kubectl get pods -A -o wide | head -n 4          # IPs come from those slices
$ ls /etc/cni/net.d /opt/cni/bin                   # on a node: CNI config and plugin binaries
$ ip route | grep 10.244                           # routes (or a tunnel device) toward other nodes' Pod CIDRs`},
{h:'Overlay versus routed networking'},
{t:[['Approach','How packets cross nodes','Pros','Cons'],
['**Overlay** (VXLAN, Geneve, IP-in-IP)','Pod traffic is encapsulated inside node-to-node packets','Works on any network; easy to install','Overhead, smaller MTU, harder to inspect'],
['**Routed / BGP**','Nodes advertise Pod CIDRs to routers or each other; no encapsulation','Fast and transparent, real source IPs','Needs a network that supports it'],
['**Cloud-native** (VPC CNI, Azure CNI)','Pods get real VPC addresses','Native routing, security groups, no overlay','Uses VPC IP space; limits per node']]},
{h:'Choosing a plugin'},
{t:[['Need','Consider'],
['Simplest lab, no policy','Flannel'],
['NetworkPolicy and BGP, widely used','Calico'],
['eBPF dataplane, observability, kube-proxy replacement','Cilium'],
['Managed cloud','The provider default (EKS VPC CNI, AKS Azure CNI, GKE dataplane)']]},
{h:'Address planning: three separate ranges'},
{ul:['**Node network**: where machines live (for example 192.168.56.0/24).','**Pod CIDR**: large, one slice per node (for example 10.244.0.0/16).','**Service CIDR**: virtual IPs for Services (for example 10.96.0.0/12), never routed on a real network.','The three must **not overlap** each other or any VPN or corporate network you need to reach. Changing them later is painful.']},
{h:'Symptoms that point at the CNI'},
{t:[['Symptom','Likely cause'],
['Node NotReady, `cni plugin not initialized`','No plugin installed, or its Pod is crash-looping'],
['Pods stuck `ContainerCreating` with `failed to set up sandbox network`','CNI binary or config missing on that node, or IP pool exhausted'],
['Pods on the same node talk, across nodes they do not','Firewall blocks the overlay port, routes missing, MTU mismatch'],
['Large responses hang, small ones work','MTU problem on the overlay'],
['IP conflicts or odd routing','Pod CIDR overlaps the node or VPN network']]},
{note:'A Pod IP is ephemeral. Never put one in a config file. Services give you a stable virtual IP and a DNS name, which is the next lecture.'}],
src:[['Cluster Networking',C+'cluster-administration/networking/'],['Network Plugins',C+'extend-kubernetes/compute-storage-net/network-plugins/'],['The Kubernetes network model',N+'#the-kubernetes-network-model']]};

/* ---------- 1: Services ---------- */
L['k8s:6:1']={blocks:[
{p:'Pods are ephemeral and their IPs change. If your web tier hard-coded the IP of an API Pod, it would break at every restart. A **Service** solves this: it is a **stable virtual IP and DNS name** in front of a changing set of Pods, with load balancing across the ready ones. It is the most important networking object in Kubernetes.'},
{svg:svc},
{h:'How a Service finds its Pods'},
{p:'A Service has a **selector**. The EndpointSlice controller continuously lists Pods matching it that are **Ready** and records their IPs in EndpointSlices. When a Pod fails readiness, is deleted or is replaced, the slice changes within seconds and traffic follows. Nothing about the Service itself changes.'},
{code:`apiVersion: v1
kind: Service
metadata: {name: api, namespace: shop}
spec:
  type: ClusterIP
  selector: {app: api}              # Pods with this label become endpoints
  ports:
  - name: http
    port: 80                        # the port clients use on the Service
    targetPort: 8080                # the port the container listens on (number or named port)
    protocol: TCP`},
{code:`$ kubectl get svc api -n shop
NAME   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
api    ClusterIP   10.96.41.20    <none>        80/TCP    3d
$ kubectl get endpointslices -n shop -l kubernetes.io/service-name=api
NAME        ADDRESSTYPE   PORTS   ENDPOINTS                    AGE
api-x7k2p   IPv4          8080    10.244.1.7,10.244.2.9        3d     # only READY Pods are listed
$ kubectl run tmp -n shop --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- http://api`},
{h:'The four Service types'},
{t:[['Type','Reachable from','How','Typical use'],
['**ClusterIP** (default)','Inside the cluster','A virtual IP from the Service CIDR','Internal APIs, databases'],
['**NodePort**','Outside, via any node IP','Also opens a port (30000 to 32767 by default) on **every node**','Labs, or behind your own load balancer'],
['**LoadBalancer**','Outside, via an external IP','Asks the cloud (or MetalLB) for a load balancer that forwards to the NodePorts','Exposing one service to the internet'],
['**ExternalName**','Inside the cluster','DNS CNAME to an external name; **no proxying, no IP**','Alias an outside dependency'],
['**Headless** (`clusterIP: None`)','Inside the cluster','No virtual IP; DNS returns the **Pod IPs** directly','StatefulSets, client-side load balancing']]},
{p:'Each type **builds on the previous one**: a LoadBalancer Service also gets a NodePort and a ClusterIP. Exposing everything as a LoadBalancer works but costs a cloud load balancer each, which is why Ingress and Gateway exist.'},
{h:'Useful settings'},
{t:[['Setting','Effect'],
['`sessionAffinity: ClientIP`','Same client IP goes to the same Pod for a period'],
['`externalTrafficPolicy: Local`','Keeps the **client source IP** and avoids an extra hop, but only nodes with local ready Pods respond'],
['`externalTrafficPolicy: Cluster` (default)','Any node can receive and forward, but source IP is replaced (SNAT)'],
['`internalTrafficPolicy: Local`','In-cluster traffic stays on the same node when possible'],
['Named `targetPort`','Lets different Pod versions use different container port numbers behind one Service'],
['Multiple ports','Each needs a `name`']]},
{h:'Without a selector'},
{p:'A Service with **no selector** creates no endpoints by itself. You create the EndpointSlice manually, which lets a Service front something outside the cluster (a database VM, another cluster) with a stable in-cluster name.'},
{h:'Troubleshooting: the Service does not work'},
{flow:['kubectl get svc: is the type, port and selector what you expect?','kubectl get endpointslices: are there ready endpoints?','If none: compare the selector with kubectl get pods --show-labels, then check readiness','If present: test the Pod IP and port directly from a debug Pod','Then test the ClusterIP, then the DNS name']},
{t:[['Finding','Cause'],
['No endpoints, Pods running','Selector mismatch or Pods not Ready'],
['Endpoints present, connection refused','`targetPort` wrong, or app listens only on 127.0.0.1'],
['Works by ClusterIP, not by name','DNS problem (next lectures)'],
['Works from inside, not outside','NodePort firewall, LoadBalancer not provisioned, ingress rules'],
['`EXTERNAL-IP <pending>`','No cloud controller or MetalLB; quota or permissions']]},
{h:'Common mistakes'},
{ul:['Confusing `port` and `targetPort`: clients use `port`, the container listens on `targetPort`.','Changing Pod labels in the Deployment without updating the Service selector.','Using a Service of type LoadBalancer per microservice and paying for dozens of load balancers.','Relying on `ExternalName` for IP-based access: it is only a DNS alias.','Expecting load balancing **per request**: it is per **connection**, so long-lived connections can stick to one Pod.']},
{note:'Only Pods that are **Ready** receive traffic. This is why readiness probes are what make Services (and rolling updates) safe.'}],
src:[['Service',N+'service/'],['Connecting Applications with Services',N+'connect-applications-service/'],['Debug Services',T+'debug/debug-application/debug-service/']]};

/* ---------- 2: EndpointSlices and kube-proxy ---------- */
L['k8s:6:2']={blocks:[
{p:'A Service IP is virtual: no machine owns it, and no process listens on it. Two components make it work: **EndpointSlices** keep the list of backends current, and **kube-proxy** (or the CNI dataplane) turns that list into kernel rules on every node. Knowing this explains Service latency, uneven balancing and the odd failure that hits only one node.'},
{h:'EndpointSlices: the list of backends'},
{p:'For every Service with a selector, the EndpointSlice controller maintains one or more **EndpointSlice** objects listing the Pods that match: IP, port, node, zone and **readiness conditions** (`ready`, `serving`, `terminating`). Each slice holds up to **100 endpoints** by default, so a Service with 1,000 Pods has about ten slices and an update touches only one. The old single `Endpoints` object did not scale: one change rewrote and resent the whole list to every node.'},
{code:`$ kubectl get endpointslices -n shop -l kubernetes.io/service-name=api -o yaml | grep -E "address|ready|nodeName|zone" | head
  - addresses: ["10.244.1.7"]
    conditions: {ready: true, serving: true, terminating: false}
    nodeName: worker1
    zone: eu-west-1a
  - addresses: ["10.244.2.9"]
    conditions: {ready: false, serving: false, terminating: false}      # failing readiness: not used for traffic
    nodeName: worker2`},
{h:'kube-proxy: from list to rules'},
{p:'kube-proxy runs on every node. It watches Services and EndpointSlices and programs the kernel so that a packet sent to a Service **ClusterIP:port** is rewritten (DNAT) to one chosen **Pod IP:targetPort**. The choice is made **when the connection is opened**; the kernel connection tracking (conntrack) then keeps later packets of that connection on the same Pod and un-translates replies.'},
{flow:['A client Pod connects to 10.96.41.20:80','The node rules match the destination and pick one ready endpoint','The destination is rewritten to 10.244.2.9:8080 (DNAT)','Conntrack remembers the mapping for the whole connection','Replies are translated back to look like they came from the Service IP']},
{t:[['Mode','How rules are built','Characteristics'],
['`iptables`','Chains of rules; random choice by probability','Current default on Linux; rules are refreshed in bulk, which slows with very many Services'],
['`nftables`','The same logic with nftables sets and maps','Newer and more scalable; the project plans to make it the default in a future release'],
['`ipvs`','Kernel hash tables (IP Virtual Server)','Fast lookups and more balancing algorithms; on a **deprecation path**, so avoid it for new clusters']]},
{code:`$ kubectl -n kube-system get cm kube-proxy -o yaml | grep -E "mode:|clusterCIDR"
    mode: ""                               # empty means the default (iptables); set it explicitly
$ kubectl -n kube-system get ds kube-proxy
$ sudo iptables -t nat -L KUBE-SERVICES -n | grep 10.96.41.20      # on a node (iptables mode)
KUBE-SVC-XYZ  tcp  --  0.0.0.0/0  10.96.41.20  tcp dpt:80
$ sudo iptables -t nat -L KUBE-SVC-XYZ -n                          # one rule per endpoint, with probabilities
$ sudo conntrack -L | grep 10.96.41.20 | head -n 3                 # live connection mappings`},
{note:'Version note: in Kubernetes 1.37 the recommended default is still `iptables`, and `nftables` is expected to become the default later. Set the mode explicitly in the kube-proxy configuration so an upgrade never changes it silently, and check release notes before relying on IPVS.'},
{h:'What this explains'},
{t:[['Observation','Explanation'],
['A Pod does not reach a Service, but the same Service works from another node','kube-proxy rules on the first node are missing or stale: check its Pod and logs'],
['Load is uneven across Pods','Balancing is per **connection**; a few long-lived HTTP/2 or gRPC connections pin traffic to few Pods'],
['The Service IP does not answer `ping`','It is virtual; only the Service ports are rewritten, ICMP is not'],
['Traffic still reaches a Pod that is shutting down','Rules update asynchronously; use readiness and a short `preStop` delay'],
['Source IP seen by the app is a node IP','`externalTrafficPolicy: Cluster` SNATs; use `Local` to keep the client IP'],
['Intermittent failures under heavy traffic','Conntrack table full or races: check `nf_conntrack` limits and CoreDNS UDP']]},
{h:'When kube-proxy is not there'},
{p:'Some CNI plugins (Cilium in kube-proxy replacement mode) implement Services themselves with eBPF, so there may be no kube-proxy DaemonSet. The Service API and behaviour are the same; only the implementation and the commands you use to inspect rules differ.'},
{h:'Troubleshooting checklist'},
{code:`kubectl get svc,endpointslices -n shop
kubectl -n kube-system get pods -l k8s-app=kube-proxy -o wide      # one per node, all Running?
kubectl -n kube-system logs ds/kube-proxy --tail=30
# on the failing node
sudo iptables-save | grep -c KUBE-                                   # rules exist?
sudo journalctl -u kubelet | grep -i proxy`},
{note:'Exam tip: you rarely edit kube-proxy. Know where its config lives (ConfigMap `kube-proxy` in `kube-system`), how to see its mode, and how to confirm that it runs on each node.'}],
src:[['EndpointSlices',N+'endpoint-slices/'],['Virtual IPs and Service Proxies',R+'networking/virtual-ips/'],['kube-proxy reference',R+'command-line-tools-reference/kube-proxy/']]};

/* ---------- 3: CoreDNS ---------- */
L['k8s:6:3']={blocks:[
{p:'Applications should find each other by **name**, not by IP. In Kubernetes that is the job of **CoreDNS**, a DNS server that runs as a Deployment in `kube-system` and answers for the cluster domain (`cluster.local` by default). When "name resolution fails" is the symptom, you need to know exactly what a Pod is configured to ask and where the answer comes from.'},
{h:'What the kubelet puts in every Pod'},
{code:`$ kubectl exec web-0 -n shop -- cat /etc/resolv.conf
search shop.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10                         # the ClusterIP of the kube-dns Service
options ndots:5`},
{ul:['**nameserver** is the `kube-dns` Service, backed by the CoreDNS Pods.','**search** domains let you use short names: `api` from the same namespace expands to `api.shop.svc.cluster.local`.','**ndots:5** means a name with **fewer than five dots** is first tried with each search domain, and only then as an absolute name. This is why external names such as `api.example.com` cause several wasted lookups.','`dnsPolicy: ClusterFirst` (default) uses this setup; `Default` inherits the node resolver; `None` uses only `dnsConfig`.']},
{h:'Names you can use'},
{t:[['Object','Name','Example'],
['Service','`<svc>.<ns>.svc.<domain>`','`api.shop.svc.cluster.local`'],
['Same namespace shortcut','`<svc>`','`api`'],
['Other namespace shortcut','`<svc>.<ns>`','`api.shop`'],
['Headless Service','Returns **all Pod IPs** (A records)','`db.shop.svc.cluster.local`'],
['StatefulSet Pod','`<pod>.<svc>.<ns>.svc.<domain>`','`db-0.db.shop.svc.cluster.local`'],
['Pod by IP','`<ip-with-dashes>.<ns>.pod.<domain>`','`10-244-1-5.shop.pod.cluster.local`'],
['SRV record for a named port','`_http._tcp.api.shop.svc.cluster.local`','port and target']]},
{h:'How a lookup flows'},
{flow:['The app asks for "api"; the resolver tries api.shop.svc.cluster.local first (search list)','The query goes to the kube-dns ClusterIP and is DNATted to a CoreDNS Pod','CoreDNS kubernetes plugin answers from the API (Services and EndpointSlices) for cluster names','Other names are forwarded to the upstream resolver','The answer (ClusterIP, or Pod IPs for headless) returns to the app']},
{h:'The CoreDNS configuration (Corefile)'},
{code:`$ kubectl -n kube-system get cm coredns -o jsonpath='{.data.Corefile}'
.:53 {
    errors
    health { lameduck 5s }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {     # answers cluster.local from the API
       pods insecure
       fallthrough in-addr.arpa ip6.arpa
       ttl 30
    }
    prometheus :9153
    forward . /etc/resolv.conf { max_concurrent 1000 }   # everything else goes to the node's upstream DNS
    cache 30
    loop
    reload
    loadbalance
}`},
{t:[['Plugin','Role'],
['`kubernetes`','Cluster names from Services and EndpointSlices'],
['`forward`','Send other names to upstream servers'],
['`cache`','Caches answers for the given seconds'],
['`loop`','Detects forwarding loops (CoreDNS crashes with a clear message)'],
['`reload`','Picks up Corefile edits automatically'],
['`health`, `ready`','Endpoints used by probes']]},
{h:'Testing DNS from a Pod'},
{code:`kubectl run dnsutils --rm -it --image=registry.k8s.io/e2e-test-images/agnhost:2.39 --restart=Never -- sh
/ # nslookup kubernetes.default
Server:    10.96.0.10
Name:      kubernetes.default.svc.cluster.local
Address:   10.96.0.1
/ # nslookup api.shop                        # cross-namespace short name
/ # nslookup example.com                     # external through forward
/ # nslookup db.shop.svc.cluster.local       # headless: several A records`},
{h:'Diagnosing DNS faults'},
{t:[['Symptom','Check','Likely cause'],
['All lookups fail','`kubectl -n kube-system get pods -l k8s-app=kube-dns`, endpoints of `kube-dns`','CoreDNS down, Service without endpoints, CNI broken'],
['Cluster names fail, external work','CoreDNS logs, NetworkPolicy to kube-dns','`kubernetes` plugin issue or policy blocking'],
['Cluster names work, external fail','Corefile `forward`, node `resolv.conf`','Upstream unreachable or wrong'],
['CoreDNS `CrashLoopBackOff`: `Loop detected`','Node `/etc/resolv.conf` points to CoreDNS itself','Fix the node resolver or `forward` target'],
['Slow or intermittent','CoreDNS CPU, `ndots`, conntrack, UDP drops','Too few replicas, search expansion, overloaded node'],
['Only one namespace fails','NetworkPolicy egress','DNS egress not allowed']]},
{code:`kubectl -n kube-system get pods -l k8s-app=kube-dns -o wide
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=30
kubectl -n kube-system get endpointslices -l kubernetes.io/service-name=kube-dns
kubectl -n kube-system get svc kube-dns`},
{note:'Exam tip: for DNS tasks the pattern is always the same: run a busybox or agnhost Pod, `nslookup` the failing name, then check CoreDNS Pods, their logs, the `kube-dns` Service and the `coredns` ConfigMap.'}],
src:[['DNS for Services and Pods',N+'dns-pod-service/'],['Debugging DNS Resolution',T+'administer-cluster/dns-debugging-resolution/'],['Customizing DNS Service',T+'administer-cluster/dns-custom-nameservers/']]};

/* ---------- 4: Ingress ---------- */
L['k8s:6:4']={blocks:[
{p:'A Service of type LoadBalancer gives one application one external address, and cloud load balancers cost money. **Ingress** lets many applications share **one entry point**: it routes external HTTP and HTTPS requests to different Services by **hostname and path**, and terminates TLS. Understanding that Ingress is **rules plus a controller** prevents the most common confusion.'},
{svg:ingress},
{h:'Two separate things'},
{t:[['Piece','What it is','Who provides it'],
['**Ingress** (the API object)','A set of routing rules: host, path, backend Service, TLS Secret','You write it'],
['**Ingress controller** (Pods)','A reverse proxy (NGINX, Traefik, HAProxy, Envoy, cloud ALB) that reads Ingress objects and configures itself','You install it once per cluster'],
['**IngressClass**','Names a controller so an Ingress can pick it (`ingressClassName`)','The controller installation']]},
{p:'An Ingress object **does nothing on its own**. Without a controller watching it, the `ADDRESS` column stays empty and no traffic is routed.'},
{code:`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
  namespace: shop
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"      # controller-specific behaviour: not portable
spec:
  ingressClassName: nginx              # which controller should handle it
  tls:
  - hosts: [shop.example.com]
    secretName: shop-tls               # a kubernetes.io/tls Secret with tls.crt and tls.key
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend: {service: {name: api, port: {number: 80}}}
      - path: /
        pathType: Prefix
        backend: {service: {name: web, port: {number: 80}}}`},
{h:'Matching rules'},
{t:[['pathType','Matches','Example for path `/api`'],
['`Exact`','The exact path only, case sensitive','`/api` yes, `/api/` no, `/api/v1` no'],
['`Prefix`','Path prefixes split on `/`','`/api`, `/api/`, `/api/v1` yes; `/apiv2` no'],
['`ImplementationSpecific`','Left to the controller','Depends on the controller']]},
{ul:['When several paths match, the **longest** prefix wins; `Exact` beats `Prefix`.','A rule without `host` matches any host; a request with a host that matches no rule goes to the default backend (if any).','Wildcard hosts (`*.example.com`) match one label only.','TLS: the controller terminates HTTPS with the certificate in the Secret; traffic to the Service is usually plain HTTP inside the cluster.']},
{h:'Using it'},
{code:`$ kubectl get ingressclass
NAME    CONTROLLER             PARAMETERS   AGE
nginx   k8s.io/ingress-nginx   <none>       10d
$ kubectl get ingress -n shop
NAME   CLASS   HOSTS              ADDRESS        PORTS     AGE
shop   nginx   shop.example.com   203.0.113.10   80, 443   2m
$ curl -H "Host: shop.example.com" http://203.0.113.10/api/health          # test before DNS exists
$ kubectl describe ingress shop -n shop        # shows backends and their endpoints
$ kubectl create ingress shop --class=nginx --rule="shop.example.com/*=web:80"`},
{h:'Choosing a controller, and an important change'},
{note:'Version note: the community **Ingress NGINX** controller has been **retired**: upstream maintenance ended in March 2026, so it gets no further fixes. Existing installs keep working, but for new designs choose another maintained controller (Traefik, HAProxy, an Envoy-based one or your cloud provider) or move to the **Gateway API** (next lecture).'},
{h:'Troubleshooting Ingress'},
{flow:['Does the Ingress have an ADDRESS? If not: is a controller installed for that ingressClassName?','Does the controller Pod run, and does it have a Service or load balancer with an external address?','Do the host and path match the request (check pathType and trailing slashes)?','Does the backend Service have ready endpoints?','Is the TLS Secret in the same namespace and does the certificate cover the host?']},
{t:[['Symptom','Cause'],
['`ADDRESS` empty','No controller for that class, or load balancer pending'],
['404 from the controller','No rule matched: wrong host, path or pathType'],
['503 from the controller','Backend Service has no ready endpoints'],
['502 / connection reset','Backend port wrong, app crashes, protocol mismatch (HTTP versus HTTPS)'],
['Certificate warning in the browser','Wrong or missing TLS Secret, certificate does not cover the host, default certificate served'],
['Works with `curl -H Host` but not by name','DNS record missing or points elsewhere']]},
{h:'Common mistakes'},
{ul:['Creating an Ingress and forgetting to install a controller.','Putting the TLS Secret in another namespace (it must be in the Ingress namespace).','Depending on controller **annotations**: they work only for that controller and make later migration painful.','Forgetting that a trailing-slash difference can change matching.','Exposing every service through a `LoadBalancer` as well as an Ingress.']},
{note:'Exam tip: `kubectl create ingress NAME --rule="host/path=service:port"` generates the object. If a controller is not installed in the exam cluster the task will say which class to use.'}],
src:[['Ingress',N+'ingress/'],['Ingress Controllers',N+'ingress-controllers/'],['Ingress NGINX Retirement','https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/']]};

/* ---------- 5: Gateway API ---------- */
L['k8s:6:5']={blocks:[
{p:'Ingress was designed for simple HTTP routing, and everything beyond that (redirects, rewrites, header matching, traffic splitting, TCP, gRPC) ended up in controller-specific **annotations** that do not carry between products. **Gateway API** is the redesigned successor: a family of standard, expressive resources with a clear **separation of roles** between the people who run the infrastructure and the people who write the application routes.'},
{h:'The resource model and who owns what'},
{t:[['Resource','Owner','Purpose','Analogy'],
['**GatewayClass**','Infrastructure provider','Names an implementation (which controller)','StorageClass, IngressClass'],
['**Gateway**','Cluster operator or platform team','Listeners: ports, protocols, hostnames, TLS; creates the data plane','The load balancer or proxy'],
['**HTTPRoute** (and GRPCRoute, TLSRoute, TCPRoute)','Application developer','Match rules and backend Services; **attaches** to a Gateway','The routing table'],
['**ReferenceGrant**','Owner of the target namespace','Allows a route or Gateway to reference objects in another namespace','A permission slip']]},
{flow:['The provider installs the controller and a GatewayClass','The platform team creates a Gateway (listeners, TLS, which namespaces may attach routes)','App teams create HTTPRoutes in their own namespaces, pointing at the Gateway','The controller programs the data plane and reports status on every object','Traffic flows: client, Gateway listener, HTTPRoute rule, backend Service']},
{code:`apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata: {name: public, namespace: infra}
spec:
  gatewayClassName: my-gateway-class
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    hostname: "*.example.com"
    tls: {mode: Terminate, certificateRefs: [{name: wildcard-tls}]}
    allowedRoutes:
      namespaces: {from: Selector, selector: {matchLabels: {expose: "true"}}}   # only labelled namespaces may attach
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: shop, namespace: shop}
spec:
  parentRefs: [{name: public, namespace: infra}]
  hostnames: [shop.example.com]
  rules:
  - matches: [{path: {type: PathPrefix, value: /api}}]
    backendRefs: [{name: api, port: 80}]
  - matches: [{path: {type: PathPrefix, value: /}}]
    backendRefs:
    - {name: web, port: 80, weight: 90}                # canary: 90 percent
    - {name: web-canary, port: 80, weight: 10}         # 10 percent`},
{h:'What it improves on Ingress'},
{t:[['Capability','Ingress','Gateway API'],
['Header, method and query matching','Annotations (controller-specific)','Built into HTTPRoute `matches`'],
['Redirects, rewrites, header changes','Annotations','Standard `filters`'],
['Traffic splitting (canary)','Annotations or extra tools','`weight` on `backendRefs`'],
['Cross-namespace and delegation','Awkward','`allowedRoutes`, `ReferenceGrant`'],
['Non-HTTP protocols','Not supported','TCP, TLS, gRPC, UDP routes'],
['Visibility of problems','Events and controller logs','**Status conditions** on every resource'],
['Portability','Poor (annotations)','Good (conformance tests)']]},
{h:'Reading the status'},
{code:`# Gateway API CRDs are not part of core Kubernetes: install the version your controller supports
$ kubectl get crd | grep gateway.networking.k8s.io
$ kubectl get gatewayclass,gateway,httproute -A
NAMESPACE   NAME                              CLASS              ADDRESS         PROGRAMMED   AGE
infra       gateway.../public                 my-gateway-class   203.0.113.20    True         5m
$ kubectl describe httproute shop -n shop | sed -n '/Status:/,$p'
  Parents:
    Conditions:
      Type: Accepted        Status: True    Reason: Accepted
      Type: ResolvedRefs    Status: False   Reason: BackendNotFound    Message: Service "apii" not found     # typo found at once`},
{ul:['**Accepted**: the Gateway or controller accepted the route (selector, hostname and namespace rules matched).','**ResolvedRefs**: all referenced Services, Secrets and ReferenceGrants resolved.','**Programmed**: the data plane has been configured.']},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['HTTPRoute `Accepted: False`','Gateway `allowedRoutes` does not include the namespace, hostname mismatch, wrong `parentRefs`'],
['`ResolvedRefs: False`','Backend Service missing or in another namespace without a ReferenceGrant'],
['Gateway has no address','Controller not running for the class, or load balancer pending'],
['404 from the Gateway','No matching rule: check hostnames, path type and listener hostname'],
['CRDs missing','Gateway API CRDs not installed or wrong version']]},
{note:'The CKA curriculum has been adding Gateway API next to Ingress. Check the current exam curriculum for the exact scope, and practise writing a Gateway and an HTTPRoute from the Kubernetes documentation.'}],
src:[['Gateway API',N+'gateway/'],['Gateway API project','https://gateway-api.sigs.k8s.io/']]};

/* ---------- 6: NetworkPolicy ---------- */
L['k8s:6:6']={blocks:[
{p:'Out of the box, **every Pod can talk to every other Pod**, in every namespace. That is convenient and dangerous: one compromised Pod can scan the whole cluster. A **NetworkPolicy** restricts traffic at layers 3 and 4 (IP, port, protocol) so that each workload can talk only to what it needs. The rules are simple, but the details (selectors, defaults, and what is **not** covered) cause most mistakes.'},
{note:'NetworkPolicy is **enforced by the CNI plugin**, not by Kubernetes itself. If your CNI does not implement it (plain Flannel does not), the objects are accepted and do nothing. Calico, Cilium, Antrea and most cloud CNIs enforce them.'},
{h:'The model in five rules'},
{ul:['Pods are **non-isolated** by default: all traffic is allowed.','A policy **selects** Pods with `podSelector`. A selected Pod becomes **isolated** for each direction listed in `policyTypes` (Ingress, Egress).','For an isolated direction, only traffic **allowed by at least one policy** is permitted. Policies are **additive**: there are no deny rules and no ordering.','Allowed peers are described by `podSelector`, `namespaceSelector` and `ipBlock`, plus optional `ports`.','Traffic allowed by policy still needs a working network and, for return traffic, replies are allowed automatically (connection tracking).']},
{h:'A complete example'},
{code:`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-policy, namespace: shop}
spec:
  podSelector: {matchLabels: {app: db}}          # these Pods are protected
  policyTypes: [Ingress, Egress]
  ingress:
  - from:
    - podSelector: {matchLabels: {app: api}}     # only api Pods (same namespace)
    ports: [{protocol: TCP, port: 5432}]
  egress:
  - to:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}
      podSelector: {matchLabels: {k8s-app: kube-dns}}     # DNS only
    ports:
    - {protocol: UDP, port: 53}
    - {protocol: TCP, port: 53}`},
{h:'The selector trap: AND versus OR'},
{p:'Inside one `from` or `to` list, **two selectors in the same item are ANDed**, while **separate items are ORed**. One stray dash changes the meaning completely.'},
{code:`# AND: Pods labelled app=api that are in a namespace labelled team=a
- from:
  - namespaceSelector: {matchLabels: {team: a}}
    podSelector: {matchLabels: {app: api}}

# OR: ALL Pods in namespaces labelled team=a, OR Pods app=api in this namespace
- from:
  - namespaceSelector: {matchLabels: {team: a}}
  - podSelector: {matchLabels: {app: api}}`},
{t:[['Selector','Matches','Remember'],
['`podSelector`','Pods in the **policy namespace** with these labels','Alone it never reaches other namespaces'],
['`namespaceSelector`','**All Pods** in namespaces with these labels','Use the automatic label `kubernetes.io/metadata.name`'],
['`ipBlock`','A CIDR with optional `except`','For traffic outside the cluster; Pod IPs are not reliable here'],
['`podSelector: {}`','Every Pod in the namespace','Used for default deny']]},
{h:'Default deny and then allow'},
{code:`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny-all, namespace: shop}
spec:
  podSelector: {}                 # every Pod in the namespace
  policyTypes: [Ingress, Egress]  # no rules = deny everything in both directions`},
{p:'After this, add allow policies one flow at a time. **Remember DNS**: once egress is denied, name resolution fails until you allow UDP and TCP port 53 to CoreDNS. Policies for different needs combine: the union of all allow rules that select a Pod applies.'},
{h:'What NetworkPolicy does not do'},
{ul:['No **deny** rules, no priorities, no logging of drops (some CNIs add these in their own policy CRDs).','No filtering above layer 4 (HTTP paths, methods) and no matching by **DNS name** in the standard API.','No effect on traffic from the node itself to its Pods in many implementations (the kubelet probes keep working), but check your CNI.','Does not encrypt traffic.']},
{h:'Testing a policy'},
{code:`kubectl -n shop run tester --rm -it --image=busybox:1.36 --restart=Never -- sh
/ # wget -qO- -T 3 http://api:80          # allowed or blocked?
/ # nc -zv -w 3 db 5432                   # from a Pod that is NOT allowed: times out
kubectl get netpol -A
kubectl describe netpol db-policy -n shop`},
{t:[['Symptom','Meaning'],
['**Timeout**','Packets are being dropped: policy or firewall'],
['**Connection refused**','Nothing listening; a policy would not produce a refusal'],
['Everything fails after a deny policy','DNS egress or the ingress controller namespace was not allowed'],
['Policy has no effect','The CNI does not enforce it, or the selector selects no Pods']]},
{h:'Common mistakes'},
{ul:['Writing the policy in the wrong namespace: `podSelector` only selects Pods **in the policy namespace**.','Forgetting `policyTypes`, so egress rules are ignored or ingress is unintentionally isolated.','Using `podSelector` where a `namespaceSelector` was needed to cross namespaces.','Blocking the ingress controller, monitoring or kube-dns by accident.','Wrong or inconsistent labels: policies are only as good as the labels.']},
{note:'Exam tip: policies are checked by what they allow. Read the task, sketch the allowed flows (from, to, port), then write the smallest policy that permits exactly them.'}],
src:[['Network Policies',N+'network-policies/'],['Declare Network Policy',T+'administer-cluster/declare-network-policy/'],['Network Policy Recipes','https://github.com/ahmetb/kubernetes-network-policy-recipes']]};

/* ---------- 7: Practical ---------- */
L['k8s:6:7']={blocks:[
{p:'In this lab you expose an application three ways, route to it with Ingress or a Gateway, and then lock it down with NetworkPolicy, verifying each boundary with a test Pod. You need a CNI that **enforces** NetworkPolicy (Calico or Cilium; kind with its default CNI does not enforce it). For each step, **predict what you will see**, then check.'},
{flow:['Deploy two apps and Services; test from inside the cluster','Expose one with NodePort and test from outside','Route by path with an Ingress or HTTPRoute','Apply default deny and watch everything break','Add the minimum allow rules and verify each boundary','Break DNS on purpose and repair it']},
{h:'1. Two apps and in-cluster access'},
{code:`kubectl create ns net-lab && kubectl config set-context --current --namespace=net-lab
kubectl create deployment web --image=nginx:1.27 --replicas=2
kubectl create deployment api --image=nginx:1.27 --replicas=2
kubectl expose deployment web --port=80
kubectl expose deployment api --port=80
kubectl get svc,endpointslices                          # each Service has two endpoints
kubectl run client --image=busybox:1.36 --restart=Never --command -- sleep 3600
kubectl exec client -- wget -qO- -T 3 http://web | head -n 3
kubectl exec client -- nslookup web                     # resolves to the ClusterIP`},
{h:'2. Break and repair a Service on purpose'},
{code:`kubectl patch svc web -p '{"spec":{"selector":{"app":"webb"}}}'
kubectl get endpointslices -l kubernetes.io/service-name=web      # ENDPOINTS <unset>
kubectl exec client -- wget -qO- -T 3 http://web                  # times out or fails
kubectl patch svc web -p '{"spec":{"selector":{"app":"web"}}}'    # repaired`},
{p:'**Lesson:** a selector typo gives a Service with **no endpoints**, found in one command.'},
{h:'3. Expose outside'},
{code:`kubectl patch svc web -p '{"spec":{"type":"NodePort"}}'
kubectl get svc web                                   # note the node port, for example 80:31234/TCP
curl http://<node-ip>:31234

# Path routing with Ingress (needs a controller) ...
kubectl create ingress apps --class=<your-class> --rule="lab.example.com/web=web:80" --rule="lab.example.com/api=api:80"
kubectl describe ingress apps
curl -H "Host: lab.example.com" http://<ingress-address>/web
# ... or with Gateway API: create a Gateway and an HTTPRoute from the previous lecture.`},
{h:'4. Default deny'},
{code:`kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny-all}
spec: {podSelector: {}, policyTypes: [Ingress, Egress]}
EOF
kubectl exec client -- wget -qO- -T 3 http://web          # now fails (timeout)
kubectl exec client -- nslookup web                       # DNS also fails: egress is denied`},
{h:'5. Allow the minimum'},
{code:`kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: allow-dns-egress}
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to: [{namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}}]
    ports: [{protocol: UDP, port: 53}, {protocol: TCP, port: 53}]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: client-to-web}
spec:
  podSelector: {matchLabels: {app: web}}
  policyTypes: [Ingress]
  ingress: [{from: [{podSelector: {matchLabels: {run: client}}}], ports: [{protocol: TCP, port: 80}]}]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: client-egress-web}
spec:
  podSelector: {matchLabels: {run: client}}
  policyTypes: [Egress]
  egress: [{to: [{podSelector: {matchLabels: {app: web}}}], ports: [{protocol: TCP, port: 80}]}]
EOF`},
{h:'6. Verify every boundary'},
{t:[['Test','Command','Expected'],
['client to web','`kubectl exec client -- wget -qO- -T 3 http://web`','Allowed (page returned)'],
['client to api','`kubectl exec client -- wget -qO- -T 3 http://api`','Timeout: egress to api not allowed'],
['another Pod to web','`kubectl run other --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- -T 3 http://web`','Timeout: ingress only from client'],
['DNS from client','`kubectl exec client -- nslookup web`','Works (DNS allowed)']]},
{p:'Notice that failures are **timeouts**, not "connection refused": a dropped packet leaves no answer. That is the signature of a policy or firewall.'},
{h:'Self-check'},
{ul:['Why did DNS stop working after default deny, and how was it restored?','Why does the `client-to-web` policy select `app=web` while `client-egress-web` selects `run=client`?','What would change if the two selectors in a `from` item were written as separate list items?','How would you let the ingress controller reach `web`?']},
{h:'Clean up'},
{code:`kubectl delete ns net-lab
kubectl config set-context --current --namespace=default`},
{note:'Exam tip: for NetworkPolicy tasks, write the YAML from the documentation example, change names and labels, apply, then test with a busybox Pod. A timeout means blocked, a refusal means no listener.'}],
src:[['Network Policies',N+'network-policies/'],['Service',N+'service/'],['Ingress',N+'ingress/']]};

/* ---------- Additional content ---------- */
/* 8: NetworkPolicy design patterns */
L['k8s:6:8']={blocks:[
{p:'Single policies are easy. A **set of policies** that secures a whole namespace without breaking it needs a pattern. Start from deny, then add precise allows.'},
{h:'Pattern 1: default deny, both directions'},
{code:`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny-all, namespace: shop}
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]`},
{h:'Pattern 2: allow DNS (required after egress deny)'},
{code:`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: allow-dns, namespace: shop}
spec:
  podSelector: {}
  policyTypes: [Egress]
  egress:
  - to:
    - namespaceSelector:
        matchLabels: {kubernetes.io/metadata.name: kube-system}
      podSelector:
        matchLabels: {k8s-app: kube-dns}
    ports:
    - {protocol: UDP, port: 53}
    - {protocol: TCP, port: 53}`},
{h:'Pattern 3: three-tier application'},
{code:`# ingress controller -> web
spec: {podSelector: {matchLabels: {tier: web}}, policyTypes: [Ingress],
  ingress: [{from: [{namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: ingress}}}], ports: [{port: 8080}]}]}
# web -> api
spec: {podSelector: {matchLabels: {tier: api}}, policyTypes: [Ingress],
  ingress: [{from: [{podSelector: {matchLabels: {tier: web}}}], ports: [{port: 8080}]}]}
# api -> db  (and the db accepts only api)
spec: {podSelector: {matchLabels: {tier: db}}, policyTypes: [Ingress],
  ingress: [{from: [{podSelector: {matchLabels: {tier: api}}}], ports: [{port: 5432}]}]}
# the egress side of web and api must also allow these flows when egress is default deny`},
{h:'Pattern 4: controlled egress to the outside'},
{code:`spec:
  podSelector: {matchLabels: {tier: api}}
  policyTypes: [Egress]
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except: [10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254/32]   # no private ranges or metadata service
    ports: [{protocol: TCP, port: 443}]`},
{h:'Pattern 5: allow monitoring and health checks'},
{ul:['Allow ingress from the namespace that holds Prometheus on the metrics port.','Kubelet probes are generally **not blocked** by NetworkPolicy on most CNIs, but check your plugin documentation.','Allow traffic from the ingress controller namespace to the exposed Services.']},
{h:'Rollout and testing'},
{flow:['Label namespaces and Pods consistently first','Apply allow policies, then the default deny','Test every flow with a debug Pod','Watch for timeouts in application logs','Keep the policies in Git with the application']},
{ul:['Policies are **additive**: you cannot write a deny rule, only remove allows.','Use clear `app` and `tier` labels; policies are only as good as the labels.','Cilium and Calico offer **cluster-wide** and **DNS-name-based** policies with their own CRDs; standard NetworkPolicy cannot match domain names.']},
{note:'Test the policy set in a staging namespace with realistic traffic. A missed DNS or health-check allow often shows up as slow starts and mysterious timeouts.'}],
src:[['Network Policies',K.C+'services-networking/network-policies/'],['Declare Network Policy',K.T+'administer-cluster/declare-network-policy/'],['Network Policy Recipes','https://github.com/ahmetb/kubernetes-network-policy-recipes']]};

/* 9: Gateway API in depth */
L['k8s:6:9']={blocks:[
{p:'Beyond a basic route, Gateway API provides rich routing, safe cross-namespace sharing and a migration path from Ingress.'},
{h:'Advanced HTTPRoute features'},
{code:`apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: shop, namespace: shop}
spec:
  parentRefs: [{name: public, namespace: infra, sectionName: https}]
  hostnames: [shop.example.com]
  rules:
  - matches:
    - headers: [{name: x-canary, value: "true"}]       # header match
    backendRefs: [{name: web-canary, port: 80}]
  - matches:
    - path: {type: PathPrefix, value: /old}
    filters:
    - type: RequestRedirect
      requestRedirect: {path: {type: ReplacePrefixMatch, replacePrefixMatch: /new}, statusCode: 301}
  - matches:
    - path: {type: PathPrefix, value: /api}
    filters:
    - type: URLRewrite
      urlRewrite: {path: {type: ReplacePrefixMatch, replacePrefixMatch: /}}
    - type: RequestHeaderModifier
      requestHeaderModifier: {add: [{name: x-source, value: gateway}]}
    backendRefs: [{name: api, port: 80}]
  - backendRefs:
    - {name: web, port: 80, weight: 90}
    - {name: web-v2, port: 80, weight: 10}`},
{h:'Cross-namespace sharing and trust'},
{ul:['A **Gateway listener** states which namespaces may attach routes (`allowedRoutes`: Same, All or a selector).','A route referencing a Service in **another namespace** needs a **ReferenceGrant** in the target namespace that allows it.','TLS certificates in another namespace also need a ReferenceGrant from that namespace.']},
{code:`apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata: {name: allow-shop-routes, namespace: backend}
spec:
  from: [{group: gateway.networking.k8s.io, kind: HTTPRoute, namespace: shop}]
  to:   [{group: "", kind: Service}]`},
{h:'Policy attachment and status'},
{ul:['Implementations offer **policy attachment** (timeouts, retries, rate limits, authentication) through their own CRDs that target a Gateway or Route.','Always read the **status conditions**: `Accepted`, `ResolvedRefs`, `Programmed` explain why a route does not work.']},
{code:`kubectl get gateway,httproute -A
kubectl describe httproute shop -n shop | sed -n '/Status:/,$p'`},
{h:'Migrating from Ingress'},
{p:'The **ingress2gateway** tool reads existing Ingress objects (and some controller annotations) and prints equivalent Gateway API resources for you to review.'},
{code:`ingress2gateway print --providers=ingress-nginx -A > gateway-resources.yaml
# review: annotations that have no equivalent are listed as warnings
kubectl apply --dry-run=server -f gateway-resources.yaml`},
{flow:['Inventory Ingresses and the annotations they use','Choose a Gateway API implementation and install the CRDs','Generate and review the new resources','Run both in parallel and shift traffic with DNS or weights','Retire the old Ingress and controller']},
{note:'Not every annotation-based feature converts automatically. Plan to re-implement rewrites, auth and rate limits with filters or the implementation policy CRDs, and test each behaviour.'}],
src:[['Gateway API',K.C+'services-networking/gateway/'],['Gateway API: HTTPRoute','https://gateway-api.sigs.k8s.io/'],['ingress2gateway','https://github.com/kubernetes-sigs/ingress2gateway']]};

/* 10: CoreDNS customization */
L['k8s:6:10']={blocks:[
{p:'The default CoreDNS configuration suits most clusters, but you will meet cases that need changes: private zones, corporate resolvers, performance tuning and reducing DNS noise.'},
{h:'Edit the Corefile'},
{code:`kubectl -n kube-system edit configmap coredns
# CoreDNS reloads automatically (the "reload" plugin); watch the Pods for errors
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=20`},
{h:'Stub domains and forwarders'},
{code:`# Send a private zone to a corporate DNS server
corp.example.com:53 {
    errors
    cache 30
    forward . 10.10.0.2 10.10.0.3
}

# Default zone block: forward unknown names to specific upstreams, not the node resolv.conf
.:53 {
    errors
    health { lameduck 5s }
    ready
    kubernetes cluster.local in-addr.arpa ip6.arpa {
        pods insecure
        fallthrough in-addr.arpa ip6.arpa
        ttl 30
    }
    prometheus :9153
    forward . 8.8.8.8 1.1.1.1 {
        max_concurrent 1000
    }
    cache 30
    loop
    reload
    loadbalance
}`},
{h:'Static entries and rewrites'},
{code:`hosts {
    10.20.30.40 legacy.internal
    fallthrough
}
rewrite name old-api.example.com api.shop.svc.cluster.local`},
{h:'ndots and search domains'},
{p:'The default `ndots:5` makes external names such as `api.example.com` trigger up to several useless searches first. Tune per Pod:'},
{code:`spec:
  dnsPolicy: ClusterFirst
  dnsConfig:
    options:
    - {name: ndots, value: "2"}
    - {name: single-request-reopen}
    searches: [extra.example.com]
    nameservers: [10.96.0.10]`},
{ul:['Names ending in a **dot** (`api.example.com.`) skip the search list.','`dnsPolicy`: `ClusterFirst` (default), `Default` (inherit node resolver), `None` (all from `dnsConfig`), `ClusterFirstWithHostNet`.']},
{h:'Performance and reliability'},
{ul:['Scale CoreDNS replicas with the cluster size (the cluster-proportional autoscaler does this on many installs).','**NodeLocal DNSCache** runs a caching agent on each node, reducing latency and conntrack pressure.','Watch CoreDNS metrics: request rate, cache hit ratio, `SERVFAIL` and latency.','Use `loop` plugin to catch forwarding loops (CrashLoopBackOff with `Loop detected`).']},
{code:`kubectl run dnsutils --rm -it --image=registry.k8s.io/e2e-test-images/agnhost:2.39 --restart=Never -- nslookup legacy.internal
kubectl -n kube-system rollout restart deployment coredns`},
{note:'Change the Corefile carefully: a syntax error crash-loops every CoreDNS Pod and takes DNS down for the whole cluster. Keep the previous version of the ConfigMap so you can restore it.'}],
src:[['Customizing DNS Service',K.T+'administer-cluster/dns-custom-nameservers/'],['DNS for Services and Pods',K.C+'services-networking/dns-pod-service/'],['Using NodeLocal DNSCache',K.T+'administer-cluster/nodelocaldns/']]};

/* 11: Cilium and eBPF */
L['k8s:6:11']={blocks:[
{p:'**eBPF** lets small, verified programs run inside the Linux kernel at hooks such as the network stack. **Cilium** uses it to implement Pod networking, Services, policy and observability without long iptables chains.'},
{h:'What eBPF changes'},
{t:[['Area','Traditional (iptables-based)','Cilium eBPF dataplane'],
['Service load balancing','kube-proxy rules scanned or matched per packet','Hash-map lookups in the kernel; can **replace kube-proxy**'],
['Policy','Rules per Pod IP and label via iptables or ipsets','Identity-based policy (label-derived identities) enforced in the datapath'],
['Visibility','Limited counters','Flow-level observability (Hubble), with metadata about Pods and Services'],
['Encryption','Needs separate tooling','Transparent WireGuard or IPsec between nodes available']]},
{h:'Extra features beyond core NetworkPolicy'},
{ul:['**CiliumNetworkPolicy** and **CiliumClusterwideNetworkPolicy**: L7 rules (HTTP methods and paths, DNS names, Kafka), entity-based rules (`world`, `kube-apiserver`), cluster-wide defaults.','**Hubble**: see which Pods talk to which, dropped flows and the policy verdicts.','**Cluster Mesh**: connect several clusters with shared services and policy.','Gateway API support and service mesh features in some modes.','Bandwidth management and egress gateway features.']},
{code:`cilium status --wait
cilium connectivity test                         # end-to-end checks

hubble observe --namespace shop --verdict DROPPED
hubble observe --from-pod shop/web --to-pod shop/api

kubectl -n kube-system get pods -l k8s-app=cilium
kubectl -n kube-system exec ds/cilium -- cilium status
kubectl get ciliumnetworkpolicies -A`},
{code:`apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata: {name: api-egress, namespace: shop}
spec:
  endpointSelector: {matchLabels: {tier: api}}
  egress:
  - toFQDNs:
    - matchName: api.payments.example.com
    toPorts:
    - ports: [{port: "443", protocol: TCP}]`},
{h:'Trade-offs'},
{ul:['Requires a reasonably recent Linux **kernel**; features depend on the kernel version.','More powerful, but a larger system to learn and operate than a simple CNI.','Managed services offer Cilium-based or Cilium-compatible dataplanes as options; check your provider documentation.','Install it **instead of** another CNI, not alongside: plan the migration carefully on a running cluster.']},
{note:'You do not need Cilium to pass the CKA, but understanding eBPF-based networking helps explain modern Kubernetes networking choices and why kube-proxy is optional.'}],
src:[['Cilium documentation','https://docs.cilium.io/'],['eBPF','https://ebpf.io/'],['Network Plugins',K.C+'extend-kubernetes/compute-storage-net/network-plugins/']]};

/* 12: MetalLB */
L['k8s:6:12']={blocks:[
{p:'On clouds, `type: LoadBalancer` creates a cloud load balancer. On **bare metal or a lab with no cloud provider**, the Service stays `<pending>`. **MetalLB** fills that gap by allocating IPs from a pool and announcing them on your network.'},
{h:'Two modes'},
{t:[['Mode','How it works','Notes'],
['**Layer 2**','One node answers ARP (IPv6: NDP) for the Service IP and receives its traffic','Simple, no router support needed; traffic enters through one node at a time, so no true load spreading across nodes for that IP'],
['**BGP**','Nodes peer with your routers and advertise the IPs','Real multi-node load balancing and failover; needs BGP-capable routers']]},
{h:'Install and configure'},
{code:`kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/<version>/config/manifests/metallb-native.yaml
kubectl -n metallb-system get pods

# metallb-config.yaml (then: kubectl apply -f metallb-config.yaml)
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata: {name: lab-pool, namespace: metallb-system}
spec:
  addresses:
  - 192.168.56.200-192.168.56.220            # free addresses on the node network
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata: {name: lab-l2, namespace: metallb-system}
spec:
  ipAddressPools: [lab-pool]`},
{code:`kubectl create deployment web --image=nginx:1.27
kubectl expose deployment web --type=LoadBalancer --port=80
kubectl get svc web                           # EXTERNAL-IP now from the pool
curl http://<external-ip>
kubectl -n metallb-system logs -l component=speaker --tail=20`},
{ul:['The address pool must not overlap DHCP or other hosts on the network.','On kube-proxy IPVS strict ARP mode, MetalLB needs `strictARP: true` in kube-proxy config.','`externalTrafficPolicy: Local` preserves the client source IP, but only nodes with local ready Pods answer.','Pair with an Ingress controller or Gateway so that one IP serves many hostnames.']},
{h:'Troubleshooting'},
{t:[['Symptom','Check'],
['EXTERNAL-IP stays pending','Controller Pod running? Pool defined? Advertisement present?'],
['IP assigned but unreachable','Same L2 segment? Firewall? ARP replies (speaker logs)? Correct pool range?'],
['Traffic works from some nodes only','`externalTrafficPolicy: Local` with Pods on few nodes']]},
{note:'Version URLs and CRD API versions change between MetalLB releases. Take the install URL and CRD examples from the current MetalLB documentation.'}],
src:[['MetalLB','https://metallb.io/'],['Create an External Load Balancer',K.T+'access-application-cluster/create-external-load-balancer/'],['Service',K.C+'services-networking/service/']]};

/* 13: Service mesh and dual-stack */
L['k8s:6:13']={blocks:[
{h:'What a service mesh adds'},
{p:'A **service mesh** moves common service-to-service features out of applications into infrastructure: a data plane of proxies (sidecars or per-node/ambient proxies) controlled by a control plane.'},
{t:[['Capability','Examples'],
['**Security**','Mutual TLS between workloads, identity-based authorization'],
['**Traffic management**','Retries, timeouts, circuit breaking, weighted routing, mirroring'],
['**Observability**','Uniform metrics, traces and access logs for every call'],
['**Resilience**','Outlier detection, fault injection for testing']]},
{ul:['Popular meshes: **Istio** (sidecar and ambient modes), **Linkerd**, **Cilium Service Mesh** and others.','Gateway API is becoming a common way to configure mesh traffic (the GAMMA initiative).']},
{h:'When is it worth the cost?'},
{t:[['Reasons to adopt','Reasons to wait'],
['Many services with a need for mTLS everywhere (compliance)','Few services or one team: libraries and NetworkPolicy may suffice'],
['Consistent retries and timeouts across languages','Added latency, CPU and memory per Pod with sidecars'],
['Detailed service-level observability and progressive delivery','A new control plane to upgrade, secure and understand'],
['A platform team to own it','No dedicated people; debugging becomes harder']]},
{p:'Adopt a mesh for a **specific problem**, start with one namespace, and measure the overhead. Some teams get mTLS and policy from their CNI (for example transparent encryption) without a full mesh.'},
{h:'Dual-stack networking (IPv4 and IPv6)'},
{p:'**Dual-stack** gives Pods and Services both IPv4 and IPv6 addresses. It is stable in current releases but must be planned when the cluster is created.'},
{code:`# kubeadm configuration
apiVersion: kubeadm.k8s.io/v1beta4
kind: ClusterConfiguration
networking:
  podSubnet: 10.244.0.0/16,fd00:10:244::/56
  serviceSubnet: 10.96.0.0/16,fd00:10:96::/112

# A dual-stack Service
spec:
  ipFamilyPolicy: PreferDualStack       # SingleStack | PreferDualStack | RequireDualStack
  ipFamilies: [IPv4, IPv6]
  selector: {app: web}
  ports: [{port: 80}]`},
{code:`kubectl get pod web -o jsonpath='{.status.podIPs}{"\\n"}'
kubectl get svc web -o jsonpath='{.spec.clusterIPs}{"\\n"}'
kubectl get node w1 -o jsonpath='{.spec.podCIDRs}{"\\n"}'`},
{ul:['The CNI, nodes, load balancers and applications must all support both families.','Services choose their families with `ipFamilyPolicy`; the first listed family is the primary.','Test client behaviour: some applications prefer IPv6 and fail when it is not routed.']},
{note:'Both topics add complexity. Decide with a clear requirement (compliance mTLS, IPv6 address space) rather than because the technology is popular.'}],
src:[['IPv4/IPv6 dual-stack',K.C+'services-networking/dual-stack/'],['Istio','https://istio.io/latest/docs/'],['Linkerd','https://linkerd.io/2/overview/']]};
})();
