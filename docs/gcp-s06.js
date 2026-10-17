/* LearnSphere - Google Cloud, Section 06: Load Balancing, CDN & Edge Security.
   Lectures 0-7 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const decide=K.dg(700,330,[
[10,10,680,310,'Choosing a load balancer',1],
[250,35,200,40,'Traffic type?',2],
[30,110,200,40,'HTTP or HTTPS (layer 7)',0],[250,110,200,40,'TCP or SSL with proxy',0],[470,110,200,40,'Any TCP, UDP, ESP, ICMP',0],
[30,180,200,50,'Application Load Balancer|URL routing, WAF, CDN',0],[250,180,200,50,'Proxy Network Load Balancer|TLS offload, global TCP',0],[470,180,200,50,'Passthrough Network LB|keeps client IP',0],
[30,255,640,40,'Then pick: external or internal, global or regional',2]],
[[350,75,130,110],[350,75,350,110],[350,75,570,110],[130,150,130,180],[350,150,350,180],[570,150,570,180]]);

const parts=K.dg(700,200,[
[10,10,680,180,'Parts of an external Application Load Balancer',1],
[20,60,100,60,'Forwarding rule|IP and port',0],[135,60,100,60,'Target proxy|plus certificate',0],[250,60,100,60,'URL map|host and path',2],[365,60,110,60,'Backend service|health check',0],[490,60,100,60,'Backends|MIG or NEG',0],[605,60,70,60,'Pods, VMs',0]],
[[120,90,135,90],[235,90,250,90],[350,90,365,90],[475,90,490,90],[590,90,605,90]]);

const urlmap=K.dg(700,260,[
[10,10,680,240,'One address, many backends',1],
[30,90,130,60,'shop.example.com',0],
[230,90,150,60,'URL map',2],
[450,40,200,40,'/api/* to API service',0],[450,110,200,40,'/static/* to bucket plus CDN',0],[450,180,200,40,'default to web service',0]],
[[160,120,230,120],[380,110,450,60],[380,120,450,130],[380,130,450,200]]);

const armor=K.dg(700,220,[
[10,10,680,200,'Cloud Armor sits in front of the backend service',1],
[30,70,100,60,'Client|attacker or user',0],[170,70,130,60,'Edge and|load balancer',0],[340,70,140,60,'Cloud Armor|policy rules',2],[520,70,150,60,'Backend service|VMs, Cloud Run',0]],
[[130,100,170,100],[300,100,340,100],[480,100,520,100]]);

/* ---------- 0 ---------- */
L['gcp:5:0']={blocks:[
{p:'A **load balancer** spreads incoming traffic across several backends, detects unhealthy ones and keeps the application available. Google Cloud offers a family of load balancers, and picking one comes down to a few questions.'},
{svg:decide},
{h:'The questions'},
{ul:['**What protocol?** HTTP and HTTPS use an Application Load Balancer. Other TCP, UDP or SSL traffic uses a Network Load Balancer.','**External or internal?** External receives traffic from the internet. Internal serves clients inside a VPC or connected networks.','**Global or regional?** Global balancers use one anycast IP address worldwide and route users to the nearest healthy backend. Regional ones work in one region.','**Proxy or passthrough?** Proxy balancers terminate the client connection and open a new one to the backend. Passthrough balancers forward packets and keep the client source IP.']},
{h:'The family'},
{t:[['Load balancer','Layer','Scope','Notes'],
['Global external Application LB','7','Global, internet','HTTP/S, URL routing, CDN, Cloud Armor, managed certificates'],
['Regional external Application LB','7','Regional, internet','Same features for one region, Standard tier or data residency'],
['Regional internal Application LB','7','Regional, internal','Internal HTTP/S for microservices'],
['Cross-region internal Application LB','7','Multi-region, internal','Internal HTTP/S with failover across regions'],
['Global external proxy Network LB','4','Global, internet','TCP with optional SSL offload'],
['Regional external or internal proxy Network LB','4','Regional','TCP proxy for non-HTTP traffic'],
['External passthrough Network LB','4','Regional, internet','TCP, UDP, ESP, ICMP, keeps client IP, high performance'],
['Internal passthrough Network LB','4','Regional, internal','Balances internal TCP/UDP such as databases and appliances']]},
{note:'Older documentation uses names such as HTTP(S), SSL proxy, TCP proxy, network and internal TCP/UDP load balancing. The classic global external Application Load Balancer still exists. New designs should use the current global external Application Load Balancer where possible.'}],
src:[['Load balancer overview',K.LB+'load-balancing-overview'],['Choose a load balancer',K.LB+'load-balancing-overview#choose']]};

/* ---------- 1 ---------- */
L['gcp:5:1']={blocks:[
{p:'Every load balancer needs **backends** to send traffic to, and **health checks** to know which of them can serve. The **backend service** ties these together.'},
{svg:parts},
{h:'Types of backend'},
{t:[['Backend','What it is','Used for'],
['Managed instance group (MIG)','A fleet of identical VMs that scales and heals','Stateless web or API tiers on VMs'],
['Unmanaged instance group','Hand-picked VMs','Special or legacy cases'],
['Zonal NEG','A set of VM IPs and ports, or GKE pod IPs (container-native)','GKE and per-container balancing'],
['Serverless NEG','Points to Cloud Run, Cloud Run functions or App Engine','Putting serverless behind a load balancer'],
['Internet NEG','An external hostname or IP outside Google Cloud','Front an origin elsewhere'],
['Hybrid NEG','IP and port endpoints on-premises or in another cloud','Hybrid or migration scenarios'],
['Backend bucket','A Cloud Storage bucket','Static websites and assets, with Cloud CDN']]},
{h:'Health checks'},
{t:[['Setting','Meaning'],
['Protocol and port','HTTP, HTTPS, HTTP/2, TCP, SSL or gRPC on a port'],
['Request path','For HTTP, such as /healthz'],
['Check interval and timeout','How often to probe and how long to wait'],
['Healthy and unhealthy thresholds','Consecutive passes or failures before the state changes']]},
{code:`gcloud compute health-checks create http web-hc --port=80 --request-path=/healthz --check-interval=10s --timeout=5s
gcloud compute backend-services create web-bes --global --protocol=HTTP --health-checks=web-hc --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend web-bes --global --instance-group=web-mig --instance-group-region=us-central1`},
{ul:['Health check probes come from Google ranges, so the VPC firewall must allow them (130.211.0.0/22 and 35.191.0.0/16).','**Balancing mode** controls how much traffic each backend receives: utilization, requests per second or connections.','**Session affinity** keeps a client on the same backend, for example by cookie or client IP.','**Connection draining** gives in-flight requests time to complete when a backend is removed.']},
{note:'If all backends show unhealthy, first check the firewall rule for health checks, then the application port and path.'}],
src:[['Backend services overview',K.LB+'backend-service'],['Health checks',K.LB+'health-check-concepts']]};

/* ---------- 2 ---------- */
L['gcp:5:2']={blocks:[
{p:'**Application Load Balancers** work at layer 7. They read the HTTP request and route by **host** and **path**, which lets one IP address and one certificate serve many applications.'},
{svg:urlmap},
{h:'Building blocks'},
{t:[['Component','Role'],
['Forwarding rule','The IP address and port that receive traffic. Global for global balancers'],
['Target HTTP or HTTPS proxy','Terminates the client connection and holds the certificate'],
['URL map','Routing rules: host and path to backend service or bucket'],
['Backend service or bucket','Group of backends with health checks and policies'],
['SSL certificate','Managed or self-managed, attached to the HTTPS proxy']]},
{h:'Create a simple HTTP load balancer'},
{code:`gcloud compute addresses create web-lb-ip --global
gcloud compute url-maps create web-map --default-service=web-bes
gcloud compute target-http-proxies create web-proxy --url-map=web-map
gcloud compute forwarding-rules create web-fr --global --load-balancing-scheme=EXTERNAL_MANAGED \\
  --address=web-lb-ip --target-http-proxy=web-proxy --ports=80`},
{h:'Path and host routing'},
{code:`gcloud compute url-maps add-path-matcher web-map --path-matcher-name=paths --default-service=web-bes \\
  --path-rules="/api/*=api-bes,/static/*=static-bucket"
gcloud compute url-maps add-host-rule web-map --hosts=shop.example.com --path-matcher-name=paths`},
{h:'Useful features'},
{ul:['URL redirects and rewrites, header manipulation, and HTTP to HTTPS redirect.','Traffic splitting by weight for canary releases.','Fault injection and retries.','HTTP/2, HTTP/3 and QUIC to clients.','Integration with Cloud CDN, Cloud Armor and Identity-Aware Proxy.']},
{h:'Global versus regional'},
{t:[['Feature','Global external','Regional external'],
['IP address','One anycast address','Regional address'],
['Failover','Across regions','Within region'],
['Network tier','Premium','Premium or Standard'],
['Use','Public applications for users worldwide','Data residency or a single region']]},
{note:'Always redirect HTTP to HTTPS and use managed certificates where possible.'}],
src:[['External Application Load Balancer',K.LB+'https'],['URL maps',K.LB+'url-map-concepts']]};

/* ---------- 3 ---------- */
L['gcp:5:3']={blocks:[
{p:'**Network Load Balancers** work at layer 4 and handle TCP, UDP and other protocols that are not HTTP. They come in two styles.'},
{h:'Passthrough Network Load Balancer'},
{ul:['Does not terminate connections. Packets pass through to the backend, and the backend sees the **original client IP**.','Backends reply directly to the client (direct server return).','Regional, supports TCP, UDP, ESP, GRE, ICMP and ICMPv6.','Very high throughput and low latency, no proxy overhead.','External and internal variants.']},
{h:'Proxy Network Load Balancer'},
{ul:['Terminates the client TCP connection and opens a new one to the backend.','Supports SSL/TLS offload, so the load balancer holds the certificate for non-HTTP TLS traffic.','Global and regional variants. The global proxy NLB gives a single anycast IP for TCP applications such as game servers or SMTP.','The backend sees the proxy address unless you enable the PROXY protocol.']},
{h:'Comparison'},
{t:[['Feature','Passthrough','Proxy'],
['Client IP at backend','Preserved','Not preserved without PROXY protocol'],
['TLS termination','No','Yes (SSL proxy)'],
['Scope','Regional','Global or regional'],
['Protocols','TCP, UDP, ESP, ICMP and more','TCP (with TLS)'],
['Typical use','Gaming UDP, VoIP, custom protocols, network appliances','Global TCP applications, TLS offload']]},
{code:`gcloud compute forwarding-rules create db-fr --region=us-central1 --load-balancing-scheme=EXTERNAL \\
  --ip-protocol=TCP --ports=3306 --backend-service=db-bes
gcloud compute backend-services create db-bes --region=us-central1 --protocol=TCP --health-checks=tcp-hc --load-balancing-scheme=EXTERNAL`},
{h:'Firewall note'},
{p:'With a passthrough balancer, traffic reaches the VM from the **client IP**, so ingress firewall rules must allow the client ranges as well as the health check ranges.'},
{note:'For ordinary web traffic use an Application Load Balancer. Use a Network Load Balancer when you need non-HTTP protocols, client IP preservation or the lowest latency.'}],
src:[['Network Load Balancers',K.LB+'network'],['Passthrough NLB overview',K.LB+'network/networklb-backend-service']]};

/* ---------- 4 ---------- */
L['gcp:5:4']={blocks:[
{p:'An **internal load balancer** has an IP address only reachable from inside your VPC (and networks connected to it). It spreads traffic between internal tiers, such as web servers calling an application tier or a service.'},
{h:'Choices'},
{t:[['Internal LB','Layer','Use'],
['Internal Application LB (regional)','7','Internal HTTP/S microservices with URL routing and managed TLS'],
['Cross-region internal Application LB','7','Same, with failover across regions'],
['Internal passthrough Network LB','4','Databases, appliances, any TCP/UDP service, preserves source IP'],
['Internal proxy Network LB','4','TCP applications that need proxy features']]},
{h:'Typical three-tier layout'},
{flow:['Internet traffic reaches a global external Application LB','The web tier MIG calls an internal Application LB in front of the app tier','The app tier connects to the database through a private IP or an internal passthrough LB','Each tier lives in its own subnet with firewall rules that allow only the previous tier']},
{h:'Requirements for internal HTTP/S'},
{ul:['A **proxy-only subnet** in the region for the Envoy proxies. They use addresses from it to reach backends.','Firewall rules allow health checks and traffic from the proxy-only subnet to the backends.','The forwarding rule has an internal IP in a normal subnet.']},
{code:`gcloud compute networks subnets create proxy-only --purpose=REGIONAL_MANAGED_PROXY --role=ACTIVE \\
  --region=us-central1 --network=prod-vpc --range=10.129.0.0/23
gcloud compute forwarding-rules create app-ilb --region=us-central1 --load-balancing-scheme=INTERNAL_MANAGED \\
  --network=prod-vpc --subnet=app-subnet --address=10.10.1.50 --ports=80 --target-http-proxy=app-proxy --target-http-proxy-region=us-central1`},
{note:'Clients in other regions can reach a regional internal balancer only if global access is enabled on the forwarding rule, or through a cross-region design.'}],
src:[['Internal Application Load Balancer',K.LB+'l7-internal'],['Internal passthrough NLB',K.LB+'internal']]};

/* ---------- 5 ---------- */
L['gcp:5:5']={blocks:[
{p:'HTTPS needs a certificate. Google Cloud load balancers terminate TLS on the target proxy, so certificates attach there.'},
{h:'Certificate options'},
{t:[['Option','How','Notes'],
['Google-managed certificate','Google provisions and renews a certificate for domains you list','Domain must point to the load balancer IP. Easiest. Provisioning can take minutes to hours'],
['Certificate Manager','Central service for managed and self-managed certs, wildcard via DNS authorization','Scales to many domains and supports certificate maps'],
['Self-managed certificate','You upload a certificate and private key','You renew it. Use when you need a specific CA or an extended validation certificate']]},
{code:`gcloud compute ssl-certificates create web-cert --domains=www.example.com,example.com --global
gcloud compute target-https-proxies create web-https-proxy --url-map=web-map --ssl-certificates=web-cert
gcloud compute forwarding-rules create web-https-fr --global --load-balancing-scheme=EXTERNAL_MANAGED \\
  --address=web-lb-ip --target-https-proxy=web-https-proxy --ports=443
gcloud compute ssl-certificates describe web-cert --global --format="value(managed.status)"`},
{h:'Redirect HTTP to HTTPS'},
{p:'Create an HTTP forwarding rule on port 80 whose URL map issues a redirect to HTTPS. This keeps users on secure connections.'},
{h:'TLS policy'},
{p:'An **SSL policy** sets the minimum TLS version and cipher profile. It applies to the target proxy.'},
{code:`gcloud compute ssl-policies create modern-tls --profile=MODERN --min-tls-version=1.2
gcloud compute target-https-proxies update web-https-proxy --ssl-policy=modern-tls`},
{h:'Encryption to backends'},
{ul:['Traffic from the load balancer to backends can be HTTP or HTTPS. Use HTTPS to protect traffic inside Google Cloud as well.','Backends can use self-signed certificates; the load balancer does not validate them.','Mutual TLS is available for some load balancers through TLS policies.']},
{note:'A managed certificate stays in PROVISIONING if DNS does not point to the load balancer IP, or if a CAA record blocks issuance. Check both first.'}],
src:[['SSL certificates overview',K.LB+'ssl-certificates'],['Certificate Manager','https://cloud.google.com/certificate-manager/docs/overview']]};

/* ---------- 6 ---------- */
L['gcp:5:6']={blocks:[
{p:'**Cloud CDN** caches content at Google\'s edge locations around the world. Requests are served from a nearby cache instead of your origin, which reduces latency, origin load and egress cost. It works with global external Application Load Balancers.'},
{h:'How it works'},
{flow:['A user requests an object from the load balancer address','The nearest edge cache checks for the object','Cache hit: the edge serves it immediately','Cache miss: the request goes to the origin (backend service or bucket), and the response is cached for next time']},
{h:'Enable it'},
{code:`gcloud compute backend-services update web-bes --global --enable-cdn --cache-mode=CACHE_ALL_STATIC
gcloud compute backend-buckets create static-assets --gcs-bucket-name=my-static-bucket --enable-cdn
gcloud compute url-maps invalidate-cdn-cache web-map --path="/images/*"`},
{h:'Cache modes'},
{t:[['Mode','Behaviour'],
['USE_ORIGIN_HEADERS','Cache only responses that carry valid cache headers such as Cache-Control'],
['CACHE_ALL_STATIC','Automatically cache common static types, plus anything with correct headers'],
['FORCE_CACHE_ALL','Cache all successful responses, even without headers. Be careful with private content']]},
{h:'Controls'},
{ul:['**Cache key** decides what counts as the same object: host, path, query string and selected headers.','**TTL settings** (default, max, client) control how long content stays valid.','**Signed URLs and signed cookies** give time-limited access to protected content.','**Invalidation** removes cached objects before expiry. Prefer versioned file names to frequent invalidation.','**Negative caching** can cache 404 or 5xx for short periods.']},
{note:'Do not cache personalized or authenticated responses unless the cache key includes what makes them different. Media CDN is a separate product designed for large media streaming.'}],
src:[['Cloud CDN overview','https://cloud.google.com/cdn/docs/overview'],['Cache modes','https://cloud.google.com/cdn/docs/using-cache-modes']]};

/* ---------- 7 ---------- */
L['gcp:5:7']={blocks:[
{p:'**Google Cloud Armor** is a web application firewall (WAF) and DDoS defense service that works with the load balancer. Security policies filter requests at the edge, before they reach your backends.'},
{svg:armor},
{h:'What it provides'},
{t:[['Capability','Detail'],
['Network DDoS protection','Always-on protection against volumetric attacks for load-balanced traffic'],
['Preconfigured WAF rules','Rules based on the OWASP Top 10 and ModSecurity Core Rule Set, such as SQL injection and cross-site scripting'],
['Custom rules','CEL expressions on IP, region, headers, paths and more'],
['Rate limiting','Throttle or ban clients that exceed a request rate'],
['Adaptive Protection','Machine learning that detects attacks on layer 7 and suggests rules'],
['Bot management and reCAPTCHA','Challenge or block automated traffic'],
['Edge security policies','Filter at the edge for CDN-cached content']]},
{h:'Policy structure'},
{ul:['A policy has numbered rules. The lowest priority number is evaluated first.','Each rule matches a condition and applies an action: allow, deny (403, 404, 502), throttle or rate-based ban.','The default rule (priority 2147483647) applies when nothing else matches.','Attach the policy to one or more backend services.']},
{code:`gcloud compute security-policies create web-policy --description="WAF for web"
gcloud compute security-policies rules create 1000 --security-policy=web-policy \\
  --expression="evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})" --action=deny-403
gcloud compute security-policies rules create 2000 --security-policy=web-policy \\
  --expression="origin.region_code == 'XX'" --action=deny-403
gcloud compute backend-services update web-bes --global --security-policy=web-policy`},
{h:'Good practice'},
{flow:['Start rules in preview mode so they log but do not block','Review logs for false positives','Tune sensitivity levels and exclusions','Switch the rules to enforce','Combine with rate limiting for login and API endpoints']},
{note:'Cloud Armor evaluates traffic at the load balancer, so it does not protect backends that can be reached directly. Restrict direct access with firewall rules and ingress settings.'}],
src:[['Cloud Armor overview','https://cloud.google.com/armor/docs/cloud-armor-overview'],['Security policy rules','https://cloud.google.com/armor/docs/security-policy-overview']]};
})();
