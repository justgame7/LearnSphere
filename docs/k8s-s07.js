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
{p:'Kubernetes defines a simple networking model and leaves the implementation to a plugin. Everything in this section depends on understanding it.'},
{svg:model},
{h:'The four rules'},
{ul:['Every Pod gets its **own IP address**, shared by its containers.','Pods can reach **any other Pod** by IP across nodes **without NAT**.','Agents on a node (kubelet, system daemons) can reach all Pods on that node.','Pods in the **host network** (`hostNetwork: true`) use the node IP and share its ports.']},
{h:'Four kinds of traffic'},
{t:[['Traffic','Solved by'],
['Container to container in one Pod','`localhost` in the shared network namespace'],
['Pod to Pod','The CNI plugin (routes or overlay)'],
['Pod to Service','kube-proxy rules (or the CNI dataplane) that translate a virtual IP to Pod IPs'],
['External to Service','NodePort, LoadBalancer, Ingress or Gateway']]},
{h:'What a CNI plugin does'},
{p:'When the kubelet creates a Pod sandbox, the runtime calls the **CNI plugin binary** (in `/opt/cni/bin`, configured in `/etc/cni/net.d`). The plugin creates a virtual ethernet pair, puts one end in the Pod namespace, assigns an IP from the node Pod CIDR (IPAM) and programs routes.'},
{code:`kubectl get nodes -o custom-columns=NAME:.metadata.name,PODCIDR:.spec.podCIDR
kubectl get pods -A -o wide
ls /etc/cni/net.d /opt/cni/bin             # on a node
kubectl cluster-info dump | grep -m1 -E "cluster-cidr|service-cluster-ip-range"
ip route                                    # on a node: routes to other nodes' Pod CIDRs`},
{h:'Choosing a plugin'},
{t:[['Need','Consider'],
['Simplest possible lab','Flannel (no NetworkPolicy)'],
['NetworkPolicy and BGP','Calico'],
['eBPF, observability, kube-proxy replacement','Cilium'],
['Managed cloud','The provider default: VPC CNI (EKS), Azure CNI (AKS), GKE dataplane']]},
{h:'Address ranges must not overlap'},
{ul:['**Node network**, **Pod CIDR** and **Service CIDR** must be three separate ranges, and none may overlap VPN or corporate networks you need to reach.','Changing them after installation is painful; plan them first.']},
{note:'A Pod IP is ephemeral. Never hard-code Pod IPs. Services give you a stable address and DNS name.'}],
src:[['Cluster Networking',C+'cluster-administration/networking/'],['Network Plugins',C+'extend-kubernetes/compute-storage-net/network-plugins/'],['The Kubernetes network model',N+'#the-kubernetes-network-model']]};

/* ---------- 1: Services ---------- */
L['k8s:6:1']={blocks:[
{p:'Pods come and go and their IPs change. A **Service** gives a set of Pods a stable virtual IP and DNS name, and load balances across the ready ones.'},
{svg:svc},
{code:`apiVersion: v1
kind: Service
metadata: {name: web}
spec:
  type: ClusterIP
  selector: {app: web}          # picks Pods by label
  ports:
  - name: http
    port: 80                    # Service port
    targetPort: 8080            # container port (number or name)
    protocol: TCP`},
{t:[['Type','Reachable from','Typical use'],
['**ClusterIP** (default)','Inside the cluster only','Internal services'],
['**NodePort**','`<any node IP>:<30000-32767>` plus ClusterIP','Quick external access, lab, feeding a load balancer'],
['**LoadBalancer**','External IP from the cloud (or MetalLB) plus NodePort and ClusterIP','Production external exposure per Service'],
['**ExternalName**','CNAME to an outside DNS name; no proxying','Alias an external dependency'],
['**Headless** (`clusterIP: None`)','DNS returns Pod IPs directly','StatefulSets, client-side discovery']]},
{code:`kubectl expose deployment web --port=80 --target-port=8080
kubectl expose deployment web --type=NodePort --port=80
kubectl get svc web -o wide
kubectl get endpointslices -l kubernetes.io/service-name=web
kubectl get endpoints web                       # older view of the same data

kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- http://web`},
{h:'Useful options'},
{ul:['`sessionAffinity: ClientIP` pins a client to one Pod.','`externalTrafficPolicy: Local` preserves the client source IP and avoids extra hops, but only nodes with local ready Pods answer.','`internalTrafficPolicy: Local` keeps in-cluster traffic on the same node.','A Service without a selector plus manually created EndpointSlices lets you front something outside the cluster.']},
{h:'Troubleshooting: no endpoints'},
{ul:['`kubectl get endpointslices` is empty: the **selector does not match** Pod labels, or Pods are **not Ready** (failed readiness probe).','Port confusion: `targetPort` must match what the container actually listens on.','Pods Running but traffic fails: check from another Pod, then from a node, to separate Service problems from NetworkPolicy and CNI problems.']},
{note:'Only Pods that are **Ready** receive traffic. That is why readiness probes are what make Services and rolling updates safe.'}],
src:[['Service',N+'service/'],['Connecting Applications with Services',N+'connect-applications-service/'],['Debug Services',T+'debug/debug-application/debug-service/']]};

/* ---------- 2: EndpointSlices and kube-proxy ---------- */
L['k8s:6:2']={blocks:[
{p:'Two components turn a Service into working traffic: **EndpointSlices** (the list of backends) and **kube-proxy** (the node rules that use it).'},
{h:'EndpointSlices'},
{ul:['For each Service with a selector, the EndpointSlice controller creates slices listing the IPs, ports, node, zone and readiness of matching Pods.','Each slice holds up to 100 endpoints by default, so large Services are spread over several slices and updates stay small.','The older `Endpoints` object still exists for compatibility but does not scale well and is deprecated in favour of slices.']},
{code:`kubectl get endpointslices -n default
kubectl describe endpointslice web-abc12
kubectl get endpointslice -l kubernetes.io/service-name=web -o yaml | grep -E "ready|addresses|zone"`},
{h:'kube-proxy'},
{p:'Runs on every node, watches Services and EndpointSlices, and programs the kernel so that connections to a ClusterIP, NodePort or load balancer IP are redirected to a backend Pod IP chosen at connection time.'},
{t:[['Mode','How','Notes'],
['`iptables`','Chains of rules with random probability selection','Current default on Linux; rules are updated in full on change, which gets slow with very many Services'],
['`nftables`','Same idea using nftables sets and maps','Newer and more scalable; the project plans to make it the default in a future release'],
['`ipvs`','Kernel IP Virtual Server hash tables','Fast lookups and more balancing algorithms; on a **deprecation path** (the project plans to remove it), so avoid it for new clusters']]},
{note:'Version note: in Kubernetes 1.37 the recommended default is still `iptables`, with `nftables` expected to become the default later. Set the mode explicitly in the KubeProxyConfiguration so an upgrade never changes it silently, and check the release notes for the IPVS removal schedule before relying on it.'},
{code:`kubectl -n kube-system get cm kube-proxy -o yaml | grep -E "mode:|clusterCIDR"
kubectl -n kube-system logs ds/kube-proxy | head
sudo iptables -t nat -L KUBE-SERVICES -n | head          # on a node (iptables mode)
sudo nft list ruleset | head                              # nftables mode`},
{h:'How a connection is rewritten'},
{flow:['Pod connects to Service IP 10.96.12.5:80','Node rule matches the destination and picks one ready endpoint','Destination is rewritten (DNAT) to 10.244.2.7:8080','Conntrack remembers the choice so replies return correctly']},
{ul:['Load balancing is **per connection**, not per request. Long-lived HTTP/2 or gRPC connections can stay on one Pod; use a mesh or client-side balancing if that matters.','Some CNIs (Cilium) can replace kube-proxy completely using eBPF.','If Services fail on a single node only, check that node kube-proxy Pod and its logs.']}],
src:[['EndpointSlices',N+'endpoint-slices/'],['Virtual IPs and Service Proxies',R+'networking/virtual-ips/'],['kube-proxy reference',R+'command-line-tools-reference/kube-proxy/']]};

/* ---------- 3: CoreDNS ---------- */
L['k8s:6:3']={blocks:[
{p:'Pods find Services by name, not IP. **CoreDNS** runs as a Deployment in `kube-system` behind the Service `kube-dns` and answers cluster DNS queries.'},
{h:'Names you can use'},
{t:[['Object','Name','Example'],
['Service','`<svc>.<ns>.svc.<cluster-domain>`','`web.shop.svc.cluster.local`'],
['Headless Service','Returns all Pod IPs','`db.shop.svc.cluster.local`'],
['StatefulSet Pod','`<pod>.<svc>.<ns>.svc.<domain>`','`db-0.db.shop.svc.cluster.local`'],
['Pod (IP based)','`<ip-with-dashes>.<ns>.pod.<domain>`','`10-244-1-5.shop.pod.cluster.local`']]},
{p:'Each Pod `/etc/resolv.conf` is set by the kubelet with the cluster DNS Service IP and **search domains**, so short names work:'},
{code:`kubectl exec -it web-0 -- cat /etc/resolv.conf
# search shop.svc.cluster.local svc.cluster.local cluster.local
# nameserver 10.96.0.10
# options ndots:5

# From namespace shop:   curl http://api            -> api.shop.svc.cluster.local
# From another namespace: curl http://api.shop      -> api.shop.svc.cluster.local`},
{p:'`ndots:5` means names with fewer than five dots are tried with each search domain first. External names such as `example.com` cause extra lookups; end the name with a dot (`example.com.`) to skip the search list.'},
{h:'The Corefile'},
{code:`kubectl -n kube-system get cm coredns -o yaml
# Corefile:
# .:53 {
#     errors
#     health { lameduck 5s }
#     ready
#     kubernetes cluster.local in-addr.arpa ip6.arpa {
#        pods insecure
#        fallthrough in-addr.arpa ip6.arpa
#        ttl 30
#     }
#     prometheus :9153
#     forward . /etc/resolv.conf
#     cache 30
#     loop
#     reload
#     loadbalance
# }`},
{ul:['`kubernetes` plugin answers cluster names.','`forward` sends everything else to upstream DNS (the node resolv.conf).','`cache` and `loop` improve speed and detect forwarding loops.']},
{h:'Test and debug DNS'},
{code:`kubectl run dnsutils --rm -it --image=registry.k8s.io/e2e-test-images/agnhost:2.39 --restart=Never -- nslookup kubernetes.default
kubectl run tmp --rm -it --image=busybox:1.36 --restart=Never -- nslookup web.shop
kubectl -n kube-system get pods -l k8s-app=kube-dns
kubectl -n kube-system logs -l k8s-app=kube-dns --tail=30
kubectl -n kube-system get svc kube-dns`},
{t:[['Symptom','Cause'],
['All lookups fail','CoreDNS Pods down, `kube-dns` Service has no endpoints, or CNI broken'],
['Cluster names work, external ones fail','`forward` upstream unreachable'],
['Intermittent slowness','`ndots` search expansion, conntrack races, overloaded CoreDNS'],
['`CrashLoopBackOff` with `loop` detected','Node resolv.conf points back to CoreDNS']]}],
src:[['DNS for Services and Pods',N+'dns-pod-service/'],['Debugging DNS Resolution',T+'administer-cluster/dns-debugging-resolution/'],['Customizing DNS Service',T+'administer-cluster/dns-custom-nameservers/']]};

/* ---------- 4: Ingress ---------- */
L['k8s:6:4']={blocks:[
{p:'A LoadBalancer Service per application gets expensive. **Ingress** routes external HTTP and HTTPS traffic to many Services by host and path through one entry point.'},
{svg:ingress},
{p:'An Ingress object is only **rules**. Nothing happens until an **Ingress controller** (a set of Pods) is installed to read them and configure a proxy.'},
{code:`apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx            # which controller handles this
  tls:
  - hosts: [shop.example.com]
    secretName: shop-tls             # kubernetes.io/tls Secret
  rules:
  - host: shop.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service: {name: api, port: {number: 80}}
      - path: /
        pathType: Prefix
        backend:
          service: {name: web, port: {number: 80}}`},
{ul:['`pathType`: `Exact`, `Prefix` or `ImplementationSpecific`.','Without `host`, the rule matches all hostnames.','Controller-specific behaviour (rewrites, timeouts, auth) is set with **annotations**, which is not portable between controllers.','`kubectl create ingress shop --rule="shop.example.com/*=web:80"` generates one.']},
{code:`kubectl get ingressclass
kubectl get ingress
kubectl describe ingress shop        # backends, events, address
curl -H "Host: shop.example.com" http://<ingress-address>/`},
{h:'Controllers'},
{t:[['Controller','Notes'],['Traefik, HAProxy, Contour, Envoy-based, cloud provider controllers (ALB, Application Gateway, GCE)','Maintained options; pick one that fits your platform'],['Ingress NGINX (community)','**Retired.** Upstream stopped maintenance in March 2026; existing installs keep running but get no fixes, so plan migration']]},
{note:'Version note: the Kubernetes project announced the retirement of the community Ingress NGINX controller, with best-effort maintenance ending in March 2026, and recommends moving to the Gateway API. The Ingress API itself remains, but it is feature-frozen. Use Gateway API for new designs where your controller supports it.'},
{h:'Troubleshooting'},
{ul:['`ADDRESS` stays empty: no controller for that IngressClass, or no load balancer provisioned.','404 from the controller: host or path mismatch; check `pathType` and trailing slashes.','503: the backend Service has no ready endpoints.','TLS errors: wrong Secret name or type, certificate does not cover the host.']}],
src:[['Ingress',N+'ingress/'],['Ingress Controllers',N+'ingress-controllers/'],['Ingress NGINX Retirement','https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/']]};

/* ---------- 5: Gateway API ---------- */
L['k8s:6:5']={blocks:[
{p:'**Gateway API** is the successor to Ingress. It splits responsibilities between roles, supports more protocols and features natively, and makes behaviour portable instead of annotation-driven. Its core HTTP resources are stable (v1).'},
{h:'Resources and who owns them'},
{t:[['Resource','Owner','Purpose'],
['**GatewayClass**','Infrastructure provider','Names an implementation (like IngressClass or StorageClass)'],
['**Gateway**','Cluster operator','A listener: ports, protocols, hostnames, TLS; creates the data plane'],
['**HTTPRoute**','Application developer','Match rules and send traffic to Services; attaches to a Gateway'],
['GRPCRoute, TLSRoute, TCPRoute, ...','Application developer','Other protocols']]},
{flow:['Provider installs controller and GatewayClass','Operator creates a Gateway referencing the class','Developers create HTTPRoutes pointing at the Gateway','Controller programs the data plane and reports status']},
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
    tls:
      mode: Terminate
      certificateRefs: [{name: wildcard-tls}]
    allowedRoutes:
      namespaces: {from: Selector, selector: {matchLabels: {expose: "true"}}}
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata: {name: shop, namespace: shop}
spec:
  parentRefs: [{name: public, namespace: infra}]
  hostnames: [shop.example.com]
  rules:
  - matches:
    - path: {type: PathPrefix, value: /api}
    backendRefs: [{name: api, port: 80}]
  - matches:
    - path: {type: PathPrefix, value: /}
    backendRefs:
    - {name: web, port: 80, weight: 90}
    - {name: web-canary, port: 80, weight: 10}`},
{h:'Why it is better than annotations'},
{ul:['**Traffic splitting**, header matching, redirects, rewrites and mirroring are part of the API.','**Cross-namespace** control: a Gateway decides which namespaces may attach routes.','**Status** on each resource shows whether it was accepted and why not.']},
{code:`# Gateway API CRDs are NOT built into Kubernetes; install the version your controller supports
kubectl get crd | grep gateway.networking.k8s.io
kubectl get gatewayclass,gateway,httproute -A
kubectl describe httproute shop -n shop        # check Accepted and ResolvedRefs conditions`},
{note:'The CNCF CKA curriculum has been adding Gateway API alongside Ingress. Check the current exam curriculum for the exact scope, and practice creating a Gateway and HTTPRoute from the docs.'}],
src:[['Gateway API',N+'gateway/'],['Gateway API project','https://gateway-api.sigs.k8s.io/']]};

/* ---------- 6: NetworkPolicy ---------- */
L['k8s:6:6']={blocks:[
{p:'By default **every Pod can talk to every other Pod**. A **NetworkPolicy** restricts that at layers 3 and 4 (IP, port, protocol).'},
{note:'NetworkPolicy is enforced by the **CNI plugin**. If your CNI does not implement it (for example plain Flannel), the objects are accepted but do nothing. Calico, Cilium and most cloud CNIs enforce them.'},
{h:'How policies work'},
{ul:['A policy selects Pods with `podSelector`. Selected Pods become **isolated** for the listed `policyTypes` (Ingress, Egress, or both).','Once any policy selects a Pod for a direction, only traffic **allowed by some policy** is permitted in that direction. Policies are additive: there is no deny rule and no ordering.','Pods not selected by any policy remain fully open.']},
{code:`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: db-allow-api, namespace: shop}
spec:
  podSelector:
    matchLabels: {app: db}
  policyTypes: [Ingress, Egress]
  ingress:
  - from:
    - podSelector: {matchLabels: {app: api}}               # same namespace
    ports:
    - {protocol: TCP, port: 5432}
  egress:
  - to:
    - namespaceSelector: {matchLabels: {kubernetes.io/metadata.name: kube-system}}
      podSelector:  {matchLabels: {k8s-app: kube-dns}}
    ports:
    - {protocol: UDP, port: 53}
    - {protocol: TCP, port: 53}`},
{h:'Selectors in from / to'},
{t:[['Selector','Matches'],
['`podSelector`','Pods in the policy namespace with the labels'],
['`namespaceSelector`','All Pods in namespaces with the labels (use the automatic label `kubernetes.io/metadata.name`)'],
['`ipBlock`','CIDR ranges, with optional `except`; typically for traffic outside the cluster']]},
{p:'**A classic trap:** two selectors in the **same list item** are ANDed (Pods with this label in those namespaces). Two **separate** list items are ORed. A stray dash changes the meaning completely.'},
{code:`# AND: pod label app=api AND namespace label team=a
- from:
  - namespaceSelector: {matchLabels: {team: a}}
    podSelector: {matchLabels: {app: api}}
# OR: any Pod in namespace team=a, OR Pods app=api in this namespace
- from:
  - namespaceSelector: {matchLabels: {team: a}}
  - podSelector: {matchLabels: {app: api}}`},
{h:'Default deny'},
{code:`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny-all, namespace: shop}
spec:
  podSelector: {}            # every Pod in the namespace
  policyTypes: [Ingress, Egress]`},
{p:'Empty `podSelector` selects all Pods, and with no rules everything is denied. Add allow policies on top. Remember to allow **DNS** egress or name resolution breaks.'},
{h:'Test'},
{code:`kubectl -n shop run tmp --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- -T 3 http://db:5432
kubectl -n shop describe networkpolicy
kubectl get netpol -A`}],
src:[['Network Policies',N+'network-policies/'],['Declare Network Policy',T+'administer-cluster/declare-network-policy/'],['Network Policy Recipes','https://github.com/ahmetb/kubernetes-network-policy-recipes']]};

/* ---------- 7: Practical ---------- */
L['k8s:6:7']={blocks:[
{p:'Lab: expose an app, route to it by path, then lock it down. Needs a CNI that enforces NetworkPolicy (Calico or Cilium; kind with its default CNI does not enforce policy unless you install one).'},
{h:'1. App and Service'},
{code:`kubectl create ns net-lab && kubectl config set-context --current --namespace=net-lab
kubectl create deployment web --image=nginx:1.27 --replicas=2
kubectl create deployment api --image=nginx:1.27 --replicas=2
kubectl expose deployment web --port=80
kubectl expose deployment api --port=80
kubectl get svc,endpointslices
kubectl run client --image=busybox:1.36 --restart=Never --command -- sleep 3600
kubectl exec client -- wget -qO- -T 3 http://web | head -n 3`},
{h:'2. Expose outside'},
{code:`kubectl patch svc web -p '{"spec":{"type":"NodePort"}}'
kubectl get svc web                              # note the node port
curl http://<node-ip>:<nodeport>

# Ingress (needs an installed controller) -- or an HTTPRoute if you use Gateway API
kubectl create ingress apps --class=<your-class> \\
  --rule="lab.example.com/web=web:80" --rule="lab.example.com/api=api:80"
kubectl describe ingress apps
curl -H "Host: lab.example.com" http://<ingress-address>/web`},
{h:'3. Lock down'},
{code:`cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: default-deny-ingress}
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: {name: allow-client-to-web}
spec:
  podSelector: {matchLabels: {app: web}}
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector: {matchLabels: {run: client}}
    ports: [{protocol: TCP, port: 80}]
EOF`},
{h:'4. Verify the boundaries'},
{code:`kubectl exec client -- wget -qO- -T 3 http://web | head -n 1     # allowed
kubectl exec client -- wget -qO- -T 3 http://api                  # times out: denied
kubectl run other --rm -it --image=busybox:1.36 --restart=Never -- wget -qO- -T 3 http://web   # denied`},
{p:'A timeout (not "connection refused") is how a dropped NetworkPolicy packet usually looks. Remember it when diagnosing: refused means nobody is listening; timeout often means a policy or firewall.'},
{h:'Clean up'},
{code:`kubectl delete ns net-lab
kubectl config set-context --current --namespace=default`},
{ul:['Break it on purpose: change the Service selector to a wrong label and watch endpoints empty out.','Add an egress deny and see DNS fail, then add the DNS allow rule.']}],
src:[['Network Policies',N+'network-policies/'],['Service',N+'service/'],['Ingress',N+'ingress/']]};
})();
