/* LearnSphere - Kubernetes Administrator, Section 09: Authentication, Authorization & RBAC.
   Lectures 0-6 are core, 7-11 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const SEC=C+'security/';
const AA=R+'access-authn-authz/';

const layers=K.dg(700,220,[
[10,10,680,200,'The 4 Cs of cloud native security: each layer builds on the one outside it',1],
[30,45,640,35,'Cloud / datacenter: network, IAM, machines',0],
[60,90,580,35,'Cluster: API server, etcd, RBAC, policies, node hardening',2],
[90,135,520,35,'Container: image, runtime, privileges',0],
[120,178,460,28,'Code: dependencies, secrets, input handling',0]],
[]);

const rbac=K.dg(700,220,[
[10,70,150,70,'Subject|User, Group or|ServiceAccount',0],
[210,70,150,70,'RoleBinding|links subject to role|(namespaced)',2],
[410,70,130,70,'Role|verbs on resources|(namespaced)',2],
[580,70,110,70,'Resources|pods, secrets,|deployments',0],
[210,10,330,40,'ClusterRoleBinding + ClusterRole: same idea, cluster-wide',1],
[210,165,330,40,'RoleBinding may also reference a ClusterRole (granted only in that namespace)',1]],
[[160,105,210,105],[360,105,410,105],[540,105,580,105]]);

/* ---------- 0: Security model ---------- */
L['k8s:8:0']={blocks:[
{p:'Everything in Kubernetes happens through the API server, so securing the cluster starts with understanding **how a request is secured on its way in**. Almost every access problem (a 401, a 403, "forbidden", a denied Pod) is explained by one question: **at which gate did the request stop?** This lecture gives you the map for the whole section.'},
{h:'Defence in layers: the 4 Cs'},
{svg:layers},
{p:'Cloud-native security is layered: **Cloud** (network, IAM, machines), **Cluster** (API server, RBAC, policies), **Container** (images, runtime privileges) and **Code** (dependencies, secrets handling). Each layer assumes the one outside it is sound. A weak outer layer (an open API endpoint, an exposed kubelet port) undermines everything inside, and a perfect cluster cannot rescue an application with a vulnerable dependency.'},
{h:'The gates every API request passes'},
{flow:['Transport: HTTPS to the API server on port 6443','Authentication: who are you?','Authorization: are you allowed to do this verb on this resource?','Admission: is the request acceptable and valid (mutating, then validating)?','Persist to etcd and return the response']},
{t:[['Gate','Question','Failure looks like','Where it is configured'],
['**Authentication**','Which identity is this?','`401 Unauthorized`','Client certificates, tokens, OIDC (API server flags)'],
['**Authorization**','May that identity do this?','`403 Forbidden: ... cannot list resource ...`','RBAC objects, `--authorization-mode`'],
['**Admission**','Does policy accept this object?','`403`/`422` with a message naming a webhook, policy or Pod Security','Admission plugins, webhooks, ValidatingAdmissionPolicy, PSA labels']]},
{p:'The order matters for diagnosis: **401 means the cluster does not know who you are**, **403 means it knows you but says no**, and an error mentioning "admission webhook" or "violates PodSecurity" means you passed both and the **object itself** was rejected.'},
{h:'Two kinds of identities'},
{t:[['','Humans (users and groups)','Workloads (service accounts)'],
['Stored as an API object?','**No.** Kubernetes has no User object','Yes: `ServiceAccount`'],
['Where identity comes from','The credential: certificate subject, token claims, identity provider','The cluster issues a signed token to the Pod'],
['Typical credential','Client certificate, OIDC token','Projected, short-lived JWT'],
['Name looks like','`jane`, `oidc:jane@example.com`, group `dev-team`','`system:serviceaccount:shop:app-sa`']]},
{h:'Authorization modes'},
{t:[['Mode','What it does'],
['`Node`','Lets each kubelet read only what its own Pods need (secrets, configmaps for its Pods)'],
['`RBAC`','Role-based rules you manage: the subject of this section'],
['`Webhook`','Delegate the decision to an external service'],
['`AlwaysAllow` / `AlwaysDeny`','Testing only, never production']]},
{p:'Authorizers run **in order** and the first one that decides wins. A normal kubeadm cluster uses `Node,RBAC`.'},
{h:'Look at your own cluster'},
{code:`# How is the API server configured?
sudo grep -E "authorization-mode|client-ca-file|oidc|anonymous-auth|enable-admission-plugins" /etc/kubernetes/manifests/kube-apiserver.yaml
# Who does the API think I am?
$ kubectl auth whoami
ATTRIBUTE   VALUE
Username    kubernetes-admin
Groups      [kubeadm:cluster-admins system:authenticated]
# What can I do?
$ kubectl auth can-i '*' '*'
yes`},
{h:'The anonymous user and common exposure'},
{ul:['Unauthenticated requests are treated as `system:anonymous` in group `system:unauthenticated`. Under RBAC they should have **no** access beyond health endpoints; never bind roles to them.','The kubelet API (port 10250) and etcd (2379) are as sensitive as the API server: restrict network access and require authentication.','The `admin.conf` credential is **cluster-admin forever** (until its certificate expires); treat it like a root password.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Sharing the kubeadm admin kubeconfig','No accountability, no revocation','Named users (OIDC or certificates) with RBAC'],
['Binding `cluster-admin` to fix a Forbidden error','Over-privileged forever','Find the missing verb/resource and grant exactly that'],
['Using the `default` ServiceAccount for everything','Every workload shares one identity','One ServiceAccount per application'],
['Leaving anonymous auth broad','Exposure of API discovery and potentially more','Disable or limit; verify with curl'],
['Believing a 403 is a network problem','Time lost debugging the wrong layer','Read the message: it names user, verb, resource, namespace']]},
{note:'When any request fails, first decide which gate rejected it (401, 403 or an admission message). That single decision removes two thirds of the possible causes.'}],
src:[['Security',SEC],['Controlling Access to the Kubernetes API',SEC+'controlling-access/'],['Cloud Native Security and Kubernetes',SEC+'cloud-native-security/']]};

/* ---------- 1: Authentication methods ---------- */
L['k8s:8:1']={blocks:[
{p:'Authentication answers one question: **who is making this request?** The API server accepts several kinds of credentials at once and tries each authenticator in turn. The first that recognises the credential supplies a **user name** and a list of **groups**. Those two values are all RBAC ever sees, so authentication design is really about producing trustworthy names and groups.'},
{h:'The authenticators'},
{t:[['Method','Credential','Who uses it','Strengths and weaknesses'],
['**Client certificates (X.509)**','A certificate signed by the cluster CA','Admins, kubelets, control plane components','Simple, no extra system; **cannot be revoked** individually, only expire'],
['**ServiceAccount tokens**','Signed JWT','Pods and automation','Short-lived and audience-bound when projected'],
['**OIDC tokens**','ID token from an identity provider','Humans','SSO, MFA, group claims, instant offboarding: **best practice for people**'],
['**Webhook token authentication**','Bearer token checked by an external service','Cloud or custom identity','Flexible; extra component to secure'],
['**Bootstrap tokens**','Short-lived token','Nodes joining a cluster','Narrow, temporary'],
['Static token or password files','(removed or discouraged)','Nobody should','Plain credentials in a file']]},
{h:'How a certificate becomes an identity'},
{p:'For a client certificate, the **Common Name (CN)** becomes the user name and each **Organization (O)** becomes a group. The API server trusts the certificate because it was signed by the CA given in `--client-ca-file`.'},
{code:`$ openssl x509 -in /etc/kubernetes/pki/apiserver-kubelet-client.crt -noout -subject
subject=O = kubeadm:cluster-admins, CN = kube-apiserver-kubelet-client

$ kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' | base64 -d | openssl x509 -noout -subject -dates
subject=O = kubeadm:cluster-admins, CN = kubernetes-admin
notBefore=Oct  1 08:00:00 2026 GMT
notAfter=Oct  1 08:00:00 2027 GMT                      # expires in a year: nobody can revoke it before that`},
{ul:['Groups come from the certificate, so **whoever signs a certificate decides the groups**: guard the CA key.','A certificate with group **`system:masters`** is cluster-admin and **bypasses RBAC**; never issue it to people. Modern kubeadm uses the group `kubeadm:cluster-admins` bound by RBAC, so access can be revoked by deleting the binding.','Certificates cannot be revoked: to cut off a leaked certificate you remove its RBAC bindings (the user stays authenticated but can do nothing) or rotate the CA.']},
{h:'Why OIDC is the standard for people'},
{flow:['kubectl asks an exec plugin for a token','The plugin opens the identity provider login (SSO, MFA)','The provider issues a short-lived ID token with claims (email, groups)','kubectl sends it as a bearer token','The API server verifies signature, issuer, audience and expiry, and maps claims to user and groups','RBAC authorises those names']},
{t:[['','Client certificate','OIDC'],
['Lifetime','Months to a year','Minutes to an hour'],
['Offboarding','Remove bindings; certificate lives on','Disable the account in the provider: effective at once'],
['MFA and SSO','No','Yes'],
['Group management','Fixed in the certificate','In the identity provider, no kubeconfig change'],
['Setup effort','Low','Higher (provider and API server configuration)']]},
{h:'Where credentials live: kubeconfig users'},
{code:`users:
- name: alice
  user:
    client-certificate-data: LS0tLS1CRUdJTi...         # certificate and key
    client-key-data: LS0tLS1CRUdJTi...
- name: ci
  user:
    token: eyJhbGciOi...                               # static bearer token
- name: oidc-user
  user:
    exec:                                              # fetch a fresh token on demand
      apiVersion: client.authentication.k8s.io/v1
      command: kubectl
      args: [oidc-login, get-token, --oidc-issuer-url=https://login.example.com, --oidc-client-id=kubernetes]`},
{h:'Managed services'},
{p:'EKS maps AWS IAM identities to Kubernetes users and groups, AKS integrates with Microsoft Entra ID, and GKE with Google identities. The mapping is provider configuration; **RBAC still decides what those identities may do**. A request can be authenticated by the cloud and still be forbidden by Kubernetes.'},
{h:'Diagnosing authentication problems'},
{t:[['Symptom','Cause'],
['`Unauthorized` right after a long time of working','Certificate or token expired (check `notAfter`, token `exp`)'],
['`x509: certificate signed by unknown authority`','kubeconfig contains the wrong cluster CA'],
['`x509: certificate has expired or is not yet valid`','Expired credential, or a wrong system clock'],
['`Unauthorized` with OIDC','Issuer or audience mismatch, clock skew, expired token'],
['Authenticated but groups missing','Groups claim not issued by the provider, or prefix mismatch in bindings']]},
{note:'Prefer short-lived credentials for people (OIDC) and for workloads (projected tokens or cloud workload identity). Keep one break-glass certificate offline for when the identity provider is down, and protect it.'}],
src:[['Authenticating',AA+'authentication/'],['Certificates and Certificate Signing Requests',AA+'certificate-signing-requests/']]};

/* ---------- 2: Users and CSR ---------- */
L['k8s:8:2']={blocks:[
{p:'Kubernetes has no user objects, so "creating a user" means giving a person a **certificate signed by the cluster CA** that contains their name and group. Handing out the CA private key would be dangerous, so Kubernetes provides the **CertificateSigningRequest (CSR) API**: the user generates a key pair and a request, an administrator **approves** it, and the controller manager signs it.'},
{flow:['The user generates a private key (never leaves their machine)','The user creates a certificate request with CN as the user name and O as the group','An admin creates a CertificateSigningRequest object containing it','The admin approves it; the controller manager signs it with the cluster CA','The admin extracts the signed certificate and gives it to the user','The user builds a kubeconfig; an admin grants permissions with RBAC']},
{h:'1. Key and request (on the user machine)'},
{code:`openssl genrsa -out jane.key 2048
openssl req -new -key jane.key -out jane.csr -subj "/CN=jane/O=dev-team"
base64 -w0 jane.csr                       # one line, used in the next step (on macOS: base64 | tr -d '\\n')`},
{h:'2. Submit and approve (as an admin)'},
{code:`cat <<EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: $(base64 -w0 jane.csr)
  signerName: kubernetes.io/kube-apiserver-client       # the signer for client certificates
  expirationSeconds: 86400                              # 1 day (minimum 10 minutes)
  usages: [client auth]
EOF

$ kubectl get csr
NAME   AGE   SIGNERNAME                            REQUESTOR          REQUESTEDDURATION   CONDITION
jane   5s    kubernetes.io/kube-apiserver-client   kubernetes-admin   24h                 Pending
$ kubectl certificate approve jane
$ kubectl get csr jane
jane   20s   kubernetes.io/kube-apiserver-client   kubernetes-admin   24h   Approved,Issued`},
{h:'3. Certificate and kubeconfig'},
{code:`kubectl get csr jane -o jsonpath='{.status.certificate}' | base64 -d > jane.crt
openssl x509 -in jane.crt -noout -subject -dates          # subject=CN = jane, O = dev-team

kubectl config set-credentials jane --client-certificate=jane.crt --client-key=jane.key --embed-certs=true
kubectl config set-context jane@lab --cluster=<cluster-name> --user=jane --namespace=dev
$ kubectl --context jane@lab get pods
Error from server (Forbidden): pods is forbidden: User "jane" cannot list resource "pods" in API group "" in the namespace "dev"`},
{p:'The Forbidden error is the **correct** result here. Jane is authenticated (the API knows her name and group) but nobody has authorized her yet. That separation is the core idea: the certificate says **who**, RBAC says **what**.'},
{h:'The fields explained'},
{t:[['Field','Meaning'],
['`signerName`','Which signer handles it. `kubernetes.io/kube-apiserver-client` for client certificates; `kubernetes.io/kubelet-serving` for kubelet serving certificates; `kubernetes.io/kube-apiserver-client-kubelet` for kubelet client certificates'],
['`usages`','What the certificate may be used for (`client auth`, `server auth`, `digital signature`, `key encipherment`)'],
['`expirationSeconds`','Requested lifetime; the signer may shorten it. Keep user certificates short'],
['`request`','The base64 encoded PEM certificate request (not the key)'],
['CN / O in the request','User name and group names the API will see']]},
{h:'Operating the CSR flow'},
{code:`kubectl get csr                                 # who has asked for what
kubectl describe csr jane
kubectl certificate deny jane                   # refuse
kubectl delete csr jane                         # tidy up after issue; the certificate remains valid
kubectl create rolebinding jane-edit --clusterrole=edit --user=jane -n dev     # give her something to do
kubectl --context jane@lab auth can-i create deployments -n dev                # yes`},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['CSR stays Pending','Nobody approved it; approval is a separate admin step'],
['Approved but no certificate (`status.certificate` empty)','The signer is not running (controller manager down) or the CA key is not available to it'],
['`Unauthorized` using the certificate','Certificate expired, wrong CA, or the key does not match'],
['Authenticated as the wrong group','`O` in the request was wrong; issue a new certificate'],
['`Forbidden` for everything','No RoleBinding yet (expected)']]},
{ul:['There is **no revocation**: to remove access before expiry delete the RoleBindings that mention the user and their groups.','Use short `expirationSeconds` so leaked certificates expire quickly.','This workflow suits a handful of admins and CI users. For many people, use OIDC instead.']},
{note:'Exam tip: the five steps are openssl key, openssl CSR, `kubectl apply` of the CSR object with the base64 request, `kubectl certificate approve`, then extract `.status.certificate`. Practise it until it takes about three minutes.'}],
src:[['Certificates and Certificate Signing Requests',AA+'certificate-signing-requests/'],['Manage TLS Certificates',T+'tls/managing-tls-in-a-cluster/'],['CertificateSigningRequest API',R+'kubernetes-api/authentication-resources/certificate-signing-request-v1/']]};

/* ---------- 3: Service accounts ---------- */
L['k8s:8:3']={blocks:[
{p:'People authenticate with certificates or OIDC. **Workloads** need identities too: a Pod that lists other Pods, a CI job that deploys, a controller that watches objects. Kubernetes gives each of them a **ServiceAccount**. Every Pod runs as one, so the default behaviour matters even when you never think about it.'},
{h:'What a ServiceAccount is'},
{p:'A ServiceAccount is a namespaced API object that represents a workload identity. Its identity string is `system:serviceaccount:<namespace>:<name>` and it belongs to the groups `system:serviceaccounts` and `system:serviceaccounts:<namespace>`. A Pod that does not name one uses the namespace **`default`** ServiceAccount, which exists in every namespace.'},
{code:`kubectl create serviceaccount app-sa -n shop
kubectl get sa -n shop

spec:
  serviceAccountName: app-sa
  automountServiceAccountToken: false      # do not mount a token unless the app calls the API`},
{h:'Projected, short-lived tokens'},
{p:'When a Pod needs API access, the kubelet requests a token through the **TokenRequest API** and mounts it as a **projected volume** at `/var/run/secrets/kubernetes.io/serviceaccount/token`. This token is a signed JWT that is **time-limited** (the kubelet renews it before expiry), **audience-bound**, and **bound to the Pod**: it becomes invalid when the Pod is deleted. Compare that with old clusters, where a Secret held a token that never expired.'},
{code:`$ kubectl exec app -n shop -- cat /var/run/secrets/kubernetes.io/serviceaccount/token | cut -d. -f2 | base64 -d 2>/dev/null
{"aud":["https://kubernetes.default.svc"],"exp":1791540000,
 "kubernetes.io":{"namespace":"shop","pod":{"name":"app","uid":"..."},"serviceaccount":{"name":"app-sa"}},
 "sub":"system:serviceaccount:shop:app-sa"}

$ kubectl create token app-sa -n shop --duration=1h             # a token for use outside the cluster, with a lifetime
$ kubectl get secret -n shop --field-selector type=kubernetes.io/service-account-token   # legacy long-lived tokens (avoid)`},
{t:[['Token kind','Lifetime','Bound to','Status'],
['Projected token (default today)','About an hour, refreshed automatically','Pod and audience','Recommended'],
['`kubectl create token`','As requested','Optionally an object','Good for tools and CI'],
['Legacy token Secret','**Never expires**','Only the ServiceAccount','Not created automatically since v1.24; avoid creating by hand']]},
{p:'You can request tokens for **other audiences** in a `projected` volume to authenticate to external systems (a secret manager, a cloud IAM role) without storing any secret: this is how **workload identity** works on EKS, AKS and GKE.'},
{h:'Why the default account matters'},
{ul:['Without `automountServiceAccountToken: false`, **every Pod gets a token**, even if the application never talks to the API.','An attacker with a shell in a Pod can read that token and use **every permission** the ServiceAccount has.','If someone binds a role to `default` "to make one app work", **every Pod in the namespace** inherits it.']},
{h:'Using a ServiceAccount from inside a Pod'},
{code:`$ kubectl exec -it app -n shop -- sh
/ # TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
/ # CA=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
/ # wget -qO- --ca-certificate=$CA --header="Authorization: Bearer $TOKEN" https://kubernetes.default.svc/api/v1/namespaces/shop/pods
Error: pods is forbidden: User "system:serviceaccount:shop:app-sa" cannot list resource "pods" in API group "" in the namespace "shop"
# once a Role and RoleBinding grant it, the same call succeeds`},
{h:'Hardening checklist'},
{t:[['Practice','Why'],
['One ServiceAccount **per application**','Permissions follow the app, not the namespace'],
['`automountServiceAccountToken: false` where the API is not needed','No token to steal'],
['Grant nothing to `default`','Keep the default account powerless'],
['Prefer projected and `create token` over Secrets','Short-lived, bound credentials'],
['Audit existing token Secrets: `get secrets -A --field-selector type=kubernetes.io/service-account-token`','Remove forgotten never-expiring credentials'],
['Use workload identity for cloud access','No static cloud keys in the cluster']]},
{h:'Common mistakes'},
{ul:['Creating a ClusterRoleBinding for `default` in a namespace "just to test".','Copying a token out of a Pod into a CI system: it expires and cannot be rotated well; use `create token` or workload identity.','Forgetting that `imagePullSecrets` can be attached to a ServiceAccount so all its Pods pull from a private registry.']},
{note:'Mental model: a Pod is a process, a ServiceAccount is its **badge**, and RBAC decides which doors the badge opens. Give each application its own badge, with only the doors it needs.'}],
src:[['Service Accounts',SEC+'service-accounts/'],['Configure Service Accounts for Pods',T+'configure-pod-container/configure-service-account/'],['Managing Service Accounts',AA+'service-accounts-admin/']]};

/* ---------- 4: RBAC ---------- */
L['k8s:8:4']={blocks:[
{p:'Authentication tells the cluster **who** you are; **RBAC (Role-Based Access Control)** decides **what you may do**. It is the main authorization mechanism and the one most often misconfigured. Its rules are few and simple, so it pays to learn them exactly: RBAC is **additive**, so there are no deny rules, and absence of a grant means no access.'},
{svg:rbac},
{h:'The four objects'},
{t:[['Object','Scope','What it holds'],
['**Role**','One namespace','A list of rules (permissions) valid in that namespace'],
['**ClusterRole**','Cluster','Rules for cluster-scoped resources (nodes, PVs), non-resource URLs, or a reusable rule set to apply in any namespace'],
['**RoleBinding**','One namespace','Connects subjects to a Role **or a ClusterRole**, **only inside that namespace**'],
['**ClusterRoleBinding**','Cluster','Connects subjects to a ClusterRole across **all** namespaces']]},
{p:'Read it as two steps: a **role** says *what is allowed*, a **binding** says *to whom, and where*. A RoleBinding that points to a ClusterRole is a very common and useful combination: the rules are defined once and granted per namespace.'},
{h:'Anatomy of a rule'},
{code:`apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: app-deployer, namespace: dev}
rules:
- apiGroups: [""]                          # "" is the core group (pods, services, configmaps, secrets)
  resources: ["pods", "pods/log"]          # resources and subresources
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]                      # deployments live in the apps group
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
- apiGroups: [""]
  resources: ["configmaps"]
  resourceNames: ["app-config"]            # only this named object (not useful with list or create)
  verbs: ["get", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: dev-team-deployer, namespace: dev}
subjects:
- {kind: Group, name: dev-team, apiGroup: rbac.authorization.k8s.io}
- {kind: User, name: jane, apiGroup: rbac.authorization.k8s.io}
- {kind: ServiceAccount, name: ci-deployer, namespace: dev}
roleRef:                                   # immutable: delete and recreate to change it
  kind: Role
  name: app-deployer
  apiGroup: rbac.authorization.k8s.io`},
{t:[['Part of a rule','Meaning','Gotchas'],
['`apiGroups`','The API group of the resource','`""` is the core group; Deployments are in `apps`, Jobs in `batch`, Ingress in `networking.k8s.io`'],
['`resources`','Resource names (plural, lower case) and **subresources**','`pods/exec`, `pods/log`, `deployments/scale` are **separate** from `pods` and `deployments`'],
['`verbs`','`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, `deletecollection`; plus special `bind`, `escalate`, `impersonate`','`list` and `watch` also return full contents, so `list secrets` reveals all Secrets'],
['`resourceNames`','Restrict to named objects','Cannot restrict `list`, `watch` or `create`'],
['`nonResourceURLs` (ClusterRole)','Paths such as `/healthz`, `/metrics`','Cluster roles only']]},
{h:'Built-in ClusterRoles'},
{t:[['ClusterRole','Gives','Notes'],
['`cluster-admin`','Everything, everywhere','Bound to the admin group; use rarely'],
['`admin`','Full control in a namespace, including Roles and RoleBindings','Granted with a RoleBinding'],
['`edit`','Read and write most objects in a namespace','**Cannot** edit Roles or bindings; can read Secrets'],
['`view`','Read-only on most objects','**Does not include Secrets**']]},
{h:'The imperative shortcuts'},
{code:`kubectl create role app-deployer --verb=get,list,watch,create --resource=deployments.apps,pods -n dev
kubectl create rolebinding dev-team-deployer --role=app-deployer --group=dev-team -n dev
kubectl create rolebinding dev-team-edit --clusterrole=edit --group=dev-team -n dev      # reuse a built-in role
kubectl create clusterrole node-viewer --verb=get,list --resource=nodes
kubectl create clusterrolebinding jane-nodes --clusterrole=node-viewer --user=jane
kubectl get roles,rolebindings -n dev
kubectl describe clusterrole view | head -n 20`},
{h:'Scope combinations: what you really get'},
{t:[['Role kind','Binding kind','Result'],
['Role','RoleBinding','Permissions in **that namespace** only'],
['ClusterRole','RoleBinding','Permissions of the ClusterRole, **only in the binding namespace** (the reusable pattern)'],
['ClusterRole','ClusterRoleBinding','Permissions in **all namespaces** and for cluster-scoped resources'],
['Role','ClusterRoleBinding','Not allowed']]},
{h:'Privilege escalation: why some permissions are dangerous'},
{ul:['**Create Pods**: the author chooses the ServiceAccount, mounts and image, so they can run code with those permissions, or mount Secrets.','**Read Secrets** (get, list or watch): includes ServiceAccount tokens and credentials.','**Create or edit Roles and bindings**, `bind`, `escalate`: you can grant yourself more. Kubernetes blocks granting permissions you do not hold, unless you have `escalate` or `bind`.','**`impersonate`**: act as someone else.','**`nodes/proxy`**: reaches the kubelet API, including exec in Pods on that node.']},
{h:'Common mistakes'},
{t:[['Mistake','Consequence','Better'],
['Binding `cluster-admin` to make an error go away','Over-privileged and hard to review','Grant the missing verb on the exact resource'],
['Wrong `apiGroups` (deployments under `""`)','Rule matches nothing; still Forbidden','Check `kubectl api-resources` for the group'],
['Granting `pods` but expecting `exec` or `logs`','Still Forbidden','Grant `pods/exec` or `pods/log` explicitly'],
['Binding to individual users','Offboarding and audit pain','Bind to groups'],
['Trying to change `roleRef`','Rejected: immutable','Delete and recreate the binding'],
['Ignoring `view` excluding Secrets','Surprise Forbidden on secrets','Add an explicit rule if truly needed']]},
{note:'Least privilege in practice: start from the built-in `view` or `edit` ClusterRoles via a RoleBinding per namespace, and add narrow custom Roles only for what they cannot cover.'}],
src:[['Using RBAC Authorization',AA+'rbac/'],['RBAC Good Practices',SEC+'rbac-good-practices/']]};

/* ---------- 5: can-i ---------- */
L['k8s:8:5']={blocks:[
{p:'RBAC problems rarely announce themselves politely: you get a `Forbidden` error, and the fix is not obvious because permissions come from several bindings, groups and roles. `kubectl auth can-i` lets you **ask the API server directly** whether a request would be allowed, for yourself or for anyone else, without trying the real operation.'},
{h:'Asking the question'},
{code:`# As yourself
kubectl auth can-i create deployments -n dev
kubectl auth can-i delete pods --all-namespaces
kubectl auth can-i '*' '*'                                  # am I cluster-admin?

# As someone else (needs impersonate permission, normally admins have it)
kubectl auth can-i list secrets -n dev --as jane
kubectl auth can-i get pods -n dev --as jane --as-group dev-team
kubectl auth can-i get pods -n dev --as system:serviceaccount:dev:app-sa

# Everything an identity may do in a namespace
$ kubectl auth can-i --list -n dev --as jane --as-group dev-team
Resources                    Non-Resource URLs   Resource Names   Verbs
deployments.apps             []                  []               [get list watch create update patch]
pods                         []                  []               [get list watch]
pods/log                     []                  []               [get list]
selfsubjectaccessreviews...  []                  []               [create]`},
{p:'**Group membership matters**: `--as jane` alone does **not** include Jane groups, so a permission granted to a group will not show. Always add `--as-group` for each group, or you will wrongly conclude she has no access.'},
{h:'Reading a Forbidden error'},
{code:`Error from server (Forbidden): pods is forbidden: User "jane" cannot list resource "pods" in API group "" in the namespace "prod"`},
{t:[['Part of the message','What to check in RBAC'],
['`User "jane"`','The identity the API server saw (and groups, if shown). Is it who you expect?'],
['`list`','The **verb**: does a rule include it?'],
['`resource "pods"`','The resource, including subresource (`pods/exec`)'],
['`API group ""`','The group: core is empty; Deployments would say `apps`'],
['`namespace "prod"`','The scope: is there a RoleBinding in **that** namespace, or a ClusterRoleBinding?']]},
{p:'The message gives you the five facts RBAC evaluates: **who, verb, resource, group, namespace**. A grant must match all five.'},
{h:'A systematic debugging procedure'},
{flow:['Confirm the identity: kubectl auth whoami (or check the certificate and token)','Reproduce with can-i using --as and --as-group','List what the identity can do with can-i --list in that namespace','Find the bindings that mention the user, groups or ServiceAccount','Read the role rules: verb, resource, API group, subresource','Add the missing rule or binding, then re-test with can-i']},
{code:`kubectl get rolebindings,clusterrolebindings -A -o wide | grep -E "jane|dev-team"
kubectl describe rolebinding dev-team-deployer -n dev
kubectl describe role app-deployer -n dev
kubectl get clusterrolebinding -o json | jq -r '.items[] | select(.subjects[]? | .name=="dev-team") | .metadata.name'
kubectl api-resources -o wide | grep -E "^deployments|^pods "      # shows API group and allowed verbs`},
{h:'Typical causes of "I granted it but it still fails"'},
{t:[['Cause','How to spot it'],
['Binding is in the wrong namespace','`get rolebinding -n <the namespace where it fails>`'],
['Subject name or kind mismatch (`User` versus `Group`, prefix `oidc:`)','Compare `kubectl auth whoami` output with the binding subject'],
['Wrong API group','Role says `""` for deployments; need `apps`'],
['Subresource missing','`pods` granted but `pods/exec` or `pods/log` needed'],
['`resourceNames` with `list` or `create`','These verbs cannot be limited by name'],
['Binding references the wrong Role name (typos)','`describe rolebinding` shows the role; check it exists'],
['Aggregated roles not yet updated','ClusterRole labels for aggregation take a moment to merge']]},
{h:'Useful discovery commands'},
{code:`kubectl auth whoami
kubectl get clusterrole view -o yaml | head -n 30
kubectl who-can delete pods -n dev                # krew plugin: who may do this?
kubectl access-matrix -n dev                      # krew plugin: overview of access
kubectl auth reconcile -f rbac.yaml               # apply RBAC manifests safely (creates or updates)`},
{note:'Exam tip: after creating a Role and RoleBinding, always verify with `kubectl auth can-i VERB RESOURCE --as USER -n NAMESPACE`. A passing check is the only proof the task is done correctly.'}],
src:[['kubectl auth can-i',R+'kubectl/generated/kubectl_auth/kubectl_auth_can-i/'],['Checking API Access',AA+'authorization/#checking-api-access'],['Using RBAC Authorization',AA+'rbac/']]};

/* ---------- 6: Practical ---------- */
L['k8s:8:6']={blocks:[
{p:'In this lab you will design RBAC for a realistic team, test every boundary with `can-i`, and then find and repair an over-broad grant. Work in a lab cluster. Before each check, **write down what you expect**; the learning is in the cases where you are surprised.'},
{h:'The scenario'},
{t:[['Subject','Namespace `dev`','Namespace `prod`','Everywhere else'],
['Group `dev-team` (people)','Deploy and inspect workloads','Read Pods and logs only','Nothing'],
['ServiceAccount `ci-deployer`','Update Deployments','Nothing','Nothing'],
['Everyone','Never read Secrets','Never read Secrets','Never read Secrets']]},
{flow:['Create namespaces and a ServiceAccount','Write a namespaced Role for deploying and bind it','Grant read-only access in prod','Test with can-i for allowed and forbidden actions','Introduce a bad shortcut and detect it','Remove it and prove the boundary is restored']},
{h:'1. Namespaces and identities'},
{code:`kubectl create ns dev; kubectl create ns prod
kubectl -n dev create sa ci-deployer
kubectl -n dev create deployment web --image=nginx:1.27
kubectl -n prod create deployment web --image=nginx:1.27`},
{h:'2. Role and binding in dev'},
{code:`kubectl apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: app-deployer, namespace: dev}
rules:
- apiGroups: ["", "apps"]
  resources: ["pods", "pods/log", "services", "configmaps", "deployments", "replicasets"]
  verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: dev-team-deployer, namespace: dev}
subjects:
- {kind: Group, name: dev-team, apiGroup: rbac.authorization.k8s.io}
- {kind: ServiceAccount, name: ci-deployer, namespace: dev}
roleRef: {kind: Role, name: app-deployer, apiGroup: rbac.authorization.k8s.io}
EOF`},
{h:'3. Read-only access in prod'},
{code:`kubectl -n prod create role pod-viewer --verb=get,list,watch --resource=pods,pods/log
kubectl -n prod create rolebinding dev-team-prod-view --role=pod-viewer --group=dev-team`},
{h:'4. Test every boundary'},
{t:[['Command','Expectation'],
['`kubectl auth can-i create deployments -n dev --as jane --as-group dev-team`','yes'],
['`kubectl auth can-i delete pods -n prod --as jane --as-group dev-team`','no'],
['`kubectl auth can-i list pods -n prod --as jane --as-group dev-team`','yes'],
['`kubectl auth can-i get secrets -n dev --as jane --as-group dev-team`','no (secrets are not in the role)'],
['`kubectl auth can-i list pods -n kube-system --as jane --as-group dev-team`','no (no binding there)'],
['`kubectl auth can-i create deployments -n dev --as system:serviceaccount:dev:ci-deployer`','yes'],
['`kubectl auth can-i create deployments -n prod --as system:serviceaccount:dev:ci-deployer`','no']]},
{code:`kubectl auth can-i --list -n dev  --as jane --as-group dev-team
kubectl auth can-i --list -n prod --as jane --as-group dev-team
kubectl auth can-i create deployments -n dev --as jane          # WITHOUT the group: "no" (the group grant is invisible)`},
{p:'The last line is worth running once: it shows that `--as jane` alone ignores group-based grants, which is a common source of false conclusions.'},
{h:'5. A bad shortcut, found and fixed'},
{code:`# Someone "fixes" a Forbidden error the quick way
kubectl create clusterrolebinding oops --clusterrole=cluster-admin --group=dev-team
kubectl auth can-i get secrets -n prod --as jane --as-group dev-team     # now YES: far too much
kubectl auth can-i delete nodes --as jane --as-group dev-team            # YES

# Find broad bindings during review
kubectl get clusterrolebinding -o wide | grep cluster-admin
kubectl get clusterrolebinding -o json | jq -r '.items[] | select(.roleRef.name=="cluster-admin") | .metadata.name+" -> "+([.subjects[]?|.kind+":"+.name]|join(","))'

kubectl delete clusterrolebinding oops
kubectl auth can-i get secrets -n prod --as jane --as-group dev-team     # no again`},
{h:'6. Diagnose a real Forbidden error'},
{code:`kubectl auth can-i get pods/log -n dev --as jane --as-group dev-team      # yes (rule includes pods/log)
kubectl auth can-i create pods/exec -n dev --as jane --as-group dev-team  # no: pods/exec was never granted
# Add it deliberately, then test again
kubectl -n dev patch role app-deployer --type=json -p '[{"op":"add","path":"/rules/-","value":{"apiGroups":[""],"resources":["pods/exec"],"verbs":["create"]}}]'
kubectl auth can-i create pods/exec -n dev --as jane --as-group dev-team  # yes`},
{h:'Self-check questions'},
{ul:['Why does the CI ServiceAccount only need a Role in `dev` and not a ClusterRole?','Which verbs on which resources would let a user read Secrets indirectly? (Hint: creating a Pod that mounts one.)','What does `can-i --list` tell you that a single check does not?','How would you grant `view` in every namespace to a group without `cluster-admin`?','What happens to Jane access if you delete her certificate but leave the group binding?']},
{h:'Clean up'},
{code:`kubectl delete ns dev prod
kubectl delete clusterrolebinding oops --ignore-not-found`},
{note:'Exam tip: RBAC tasks end with a `can-i` proof. A typical flow: `kubectl create role`, `kubectl create rolebinding`, then `kubectl auth can-i ... --as ...`. Learn the imperative forms so you never write YAML for them.'}],
src:[['Using RBAC Authorization',AA+'rbac/'],['RBAC Good Practices',SEC+'rbac-good-practices/']]};

/* ---------- Additional content ---------- */
/* 7: OIDC */
L['k8s:8:7']={blocks:[
{p:'**OpenID Connect (OIDC)** lets people sign in to Kubernetes with your company identity provider (Entra ID, Okta, Keycloak, Google). You get single sign-on, MFA, short-lived tokens and instant offboarding.'},
{h:'How it works'},
{flow:['kubectl runs an exec plugin (for example kubelogin) to start login','The user signs in at the identity provider in a browser','The provider issues a signed ID token (JWT) containing claims such as email and groups','kubectl sends the token as a bearer token to the API server','The API server verifies signature, issuer, audience and expiry, maps claims to a user name and groups','RBAC authorizes those names and groups']},
{h:'API server configuration'},
{p:'The classic way is a set of flags. Newer releases also support a structured **AuthenticationConfiguration** file, which is more flexible (several issuers, claim validation rules, CEL mapping).'},
{code:`# kube-apiserver flags (static Pod manifest)
--oidc-issuer-url=https://login.example.com/realms/corp
--oidc-client-id=kubernetes
--oidc-username-claim=email
--oidc-username-prefix=oidc:
--oidc-groups-claim=groups
--oidc-groups-prefix=oidc:

# Newer style: a file passed with --authentication-config
apiVersion: apiserver.config.k8s.io/v1
kind: AuthenticationConfiguration
jwt:
- issuer:
    url: https://login.example.com/realms/corp
    audiences: [kubernetes]
  claimMappings:
    username: {claim: email, prefix: "oidc:"}
    groups:   {claim: groups, prefix: "oidc:"}`},
{h:'Group-based RBAC'},
{code:`kubectl create clusterrolebinding oidc-platform-admins --clusterrole=cluster-admin --group=oidc:platform-admins
kubectl create rolebinding oidc-shop-devs -n shop --clusterrole=edit --group=oidc:shop-developers`},
{ul:['Use **prefixes** so that identity-provider names cannot collide with built-in names such as `system:masters`.','Bind roles to **groups**, not individual users: membership changes happen in the IdP and take effect at the next token.','Tokens are short lived (minutes to an hour); the refresh token lives in the plugin cache.','The kubeconfig user uses an **exec** credential plugin.']},
{code:`kubectl config set-credentials oidc-user \\
  --exec-api-version=client.authentication.k8s.io/v1 \\
  --exec-command=kubectl --exec-arg=oidc-login \\
  --exec-arg=get-token --exec-arg=--oidc-issuer-url=https://login.example.com/realms/corp \\
  --exec-arg=--oidc-client-id=kubernetes
kubectl auth whoami                      # shows the user and groups the API server derived`},
{h:'Troubleshooting'},
{t:[['Symptom','Cause'],
['`Unauthorized` after login','Issuer URL mismatch, wrong audience or client ID, token expired, clock skew'],
['Logged in but `Forbidden`','No RoleBinding for the user or group; the group claim is missing or has a different prefix'],
['No groups present','The IdP does not include the groups claim for the client; add a mapper or scope'],
['API server will not start','Cannot reach the issuer discovery URL, or CA for it is missing (`--oidc-ca-file`)']]},
{note:'Keep one break-glass credential (a certificate kept offline) for when the identity provider is unavailable, and protect it carefully.'}],
src:[['Authenticating: OpenID Connect tokens',K.R+'access-authn-authz/authentication/#openid-connect-tokens'],['Structured authentication configuration',K.R+'access-authn-authz/authentication/#using-authentication-configuration'],['client-go credential plugins',K.R+'access-authn-authz/authentication/#client-go-credential-plugins']]};

/* 8: Impersonation */
L['k8s:8:8']={blocks:[
{p:'**Impersonation** lets an authenticated identity act **as another user, group or service account**. It is the mechanism behind `kubectl --as`, and it is useful for testing RBAC and for building platforms and proxies.'},
{h:'Using it'},
{code:`kubectl get pods -n shop --as jane
kubectl get pods -n shop --as jane --as-group dev-team
kubectl get pods -n shop --as system:serviceaccount:shop:app-sa
kubectl auth can-i delete deployments -n shop --as jane

# The audit log records both the real user and the impersonated one`},
{h:'Impersonation is itself a permission'},
{p:'The caller needs the verb **impersonate** on the resource it wants to impersonate (`users`, `groups`, `serviceaccounts`, `uids`, `userextras`).'},
{code:`apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: {name: impersonate-dev}
rules:
- apiGroups: [""]
  resources: ["users"]
  verbs: ["impersonate"]
  resourceNames: ["jane", "bob"]            # limit WHO may be impersonated
- apiGroups: [""]
  resources: ["groups"]
  verbs: ["impersonate"]
  resourceNames: ["dev-team"]`},
{ul:['Without `resourceNames`, the caller can impersonate **any** user, including cluster admins.','To impersonate groups you must also grant `impersonate` on `groups`; to impersonate a service account use the `serviceaccounts` resource in its namespace.','Newer releases add constrained impersonation, where the caller can be limited to act only for specific actions; check the current docs for availability.']},
{h:'Security and audit'},
{ul:['Impersonation is a **privilege escalation path**: grant it rarely and narrowly.','The audit log shows `impersonatedUser` next to `user`, so actions remain attributable.','Use it to **test RBAC changes** before releasing them, and for support tooling that must view the cluster as a user.']},
{code:`kubectl get clusterroles -o json | jq -r '.items[] | select(.rules[]? | .verbs[]? == "impersonate") | .metadata.name'
kubectl who-can impersonate users`},
{note:'A clean pattern: platform engineers keep normal permissions and hold impersonate rights only for a test group, so they can reproduce user problems without gaining their rights directly.'}],
src:[['User impersonation',K.R+'access-authn-authz/authentication/#user-impersonation'],['RBAC Good Practices',K.C+'security/rbac-good-practices/']]};

/* 9: Webhook auth */
L['k8s:8:9']={blocks:[
{p:'When built-in authenticators and RBAC are not enough, the API server can call **external webhooks** to authenticate tokens or authorize requests.'},
{h:'Webhook token authentication'},
{p:'The API server sends a `TokenReview` containing the bearer token to your service, which answers whether it is valid and returns the user information.'},
{code:`# --authentication-token-webhook-config-file=/etc/kubernetes/authn-webhook.yaml  (a kubeconfig that points at the service)
apiVersion: authentication.k8s.io/v1
kind: TokenReview
spec: {token: "<bearer token>"}
# response
status:
  authenticated: true
  user: {username: "alice", groups: ["eng"], uid: "42"}`},
{h:'Webhook authorization'},
{p:'For each request the API server sends a `SubjectAccessReview` and your service answers allowed or denied. Authorizers run **in order** (`--authorization-mode=Node,RBAC,Webhook`): the first that decides wins.'},
{code:`apiVersion: authorization.k8s.io/v1
kind: SubjectAccessReview
spec:
  user: jane
  groups: [dev-team]
  resourceAttributes: {namespace: shop, verb: delete, resource: pods}
# response
status: {allowed: false, denied: true, reason: "deletes blocked outside change windows"}`},
{h:'Failure modes to plan for'},
{t:[['Risk','Mitigation'],
['Webhook service down','Behaviour depends on `failurePolicy` (and the order of authorizers). A fail-closed webhook can lock everyone out'],
['High latency on every request','Cache decisions (`authorizedTTL`, `unauthorizedTTL`), run replicas close to the API server, set timeouts'],
['The webhook runs inside the cluster it protects','Circular dependency: it must start before it can authorize; use static Pods or host networking for it'],
['Compromised webhook','It can approve anything: secure it like the API server itself, use mutual TLS']]},
{ul:['Keep break-glass access that does not depend on the webhook (certificates in `system:masters` kept offline).','Newer releases support **structured authorization configuration** files with several webhooks and CEL pre-filters to skip unnecessary calls.','On managed services you usually cannot add webhook authorizers; use the provider identity and RBAC integration instead.']},
{h:'Where this is used'},
{ul:['Cloud providers: IAM-based token authentication (for example EKS uses a webhook-style authenticator).','Policy engines that decide with attributes beyond RBAC (time windows, ticket references).','Custom corporate SSO without OIDC support.']},
{note:'Before reaching for a webhook, check whether RBAC plus OIDC groups, or admission policy for the object content, solves the problem with less risk.'}],
src:[['Webhook Mode (authorization)',K.R+'access-authn-authz/webhook/'],['Authenticating: webhook token authentication',K.R+'access-authn-authz/authentication/#webhook-token-authentication'],['Authorization overview',K.R+'access-authn-authz/authorization/']]};

/* 10: Kubelet authz */
L['k8s:8:10']={blocks:[
{p:'The **kubelet API** (port 10250) exposes Pod logs, exec, metrics and node information. Anyone who can reach it with the right credentials can do far more than monitoring. Locking it down is a classic hardening task.'},
{h:'Authentication and authorization of the kubelet'},
{code:`# /var/lib/kubelet/config.yaml  (KubeletConfiguration)
authentication:
  anonymous: {enabled: false}              # reject unauthenticated requests
  webhook: {enabled: true, cacheTTL: 2m}   # validate bearer tokens with the API server
  x509:
    clientCAFile: /etc/kubernetes/pki/ca.crt
authorization:
  mode: Webhook                            # NOT AlwaysAllow: ask the API server (RBAC) per request
readOnlyPort: 0                            # disable the legacy unauthenticated read-only port 10255
protectKernelDefaults: true
serverTLSBootstrap: true                   # request a serving certificate through the CSR API`},
{ul:['With **Webhook** authorization the kubelet asks the API server whether the caller may perform the action on a **node subresource** such as `nodes/proxy`, `nodes/stats`, `nodes/metrics` or `nodes/log`.','**Anonymous access** and the **read-only port** must be disabled; the CIS benchmark flags both.','The API server reaches kubelets using its own client certificate (`apiserver-kubelet-client`).']},
{h:'The problem with coarse permissions'},
{p:'Historically, a monitoring agent that needed `/metrics` or `/stats` had to be granted **`nodes/proxy`**, which also allows running commands in any Pod on that node through the kubelet API. That is a privileged capability for something that only reads metrics.'},
{h:'Fine-grained kubelet authorization'},
{p:'Newer Kubernetes releases add narrower node subresources so you can grant just what the agent needs, for example read access to **metrics**, **stats**, **pods** and **healthz**, instead of the broad `nodes/proxy`. The feature is gated and has been moving through its stages; check the release notes for your version.'},
{code:`apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata: {name: kubelet-metrics-reader}
rules:
- apiGroups: [""]
  resources: ["nodes/metrics", "nodes/stats"]     # fine-grained subresources instead of nodes/proxy
  verbs: ["get"]

# Find who currently holds the powerful permission
kubectl get clusterrole -o json | jq -r '.items[] | select(.rules[]? | (.resources[]? | test("nodes/proxy"))) | .metadata.name'`},
{h:'Checks'},
{code:`# Is anonymous access blocked? (expect 401)
curl -sk https://<node-ip>:10250/pods | head -c 100
# Is the read-only port closed? (expect connection refused)
curl -s http://<node-ip>:10255/pods | head -c 100
sudo grep -E "anonymous|mode:|readOnlyPort" /var/lib/kubelet/config.yaml`},
{note:'Treat `nodes/proxy` like cluster-admin on the node: anyone who has it can read logs and execute commands in Pods there. Audit every ClusterRole and binding that includes it.'}],
src:[['Kubelet authentication and authorization',K.R+'access-authn-authz/kubelet-authn-authz/'],['Kubelet configuration',K.R+'config-api/kubelet-config.v1beta1/'],['Securing a Cluster',K.T+'administer-cluster/securing-a-cluster/']]};

/* 11: Certificate rotation and Pod certificates */
L['k8s:8:11']={blocks:[
{p:'Certificates expire. Automatic rotation keeps clusters healthy without midnight renewals, and newer features extend the idea to certificates issued **to Pods**.'},
{h:'Kubelet client certificate rotation'},
{ul:['The kubelet client certificate (how the node authenticates to the API server) can **rotate itself** when `rotateCertificates: true` (the kubeadm default).','The kubelet submits a CertificateSigningRequest with signer `kubernetes.io/kube-apiserver-client-kubelet`. The controller manager **auto-approves** these for node identities.','Verify with the CSR list and certificate files.']},
{code:`kubectl get csr | grep -E "kubelet|node-csr"
sudo ls -l /var/lib/kubelet/pki/
sudo openssl x509 -in /var/lib/kubelet/pki/kubelet-client-current.pem -noout -dates
grep rotateCertificates /var/lib/kubelet/config.yaml`},
{h:'Kubelet serving certificate'},
{p:'The kubelet serves HTTPS on 10250. By default kubeadm gives it a **self-signed** certificate, so tools that verify it fail. With `serverTLSBootstrap: true` the kubelet requests a serving certificate through a CSR with signer `kubernetes.io/kubelet-serving`.'},
{code:`kubectl get csr                                  # Pending requests of signerName kubernetes.io/kubelet-serving
kubectl certificate approve csr-xxxxx            # serving CSRs are NOT auto-approved by default
# automate approval with a vetted approver controller rather than blindly approving everything`},
{ul:['**Serving CSRs are not auto-approved** for good reason: the SANs (names and IPs) must be checked.','Metrics Server and other tools that talk to kubelets benefit from a properly signed serving certificate (so they do not need `--kubelet-insecure-tls`).']},
{h:'Control plane certificates'},
{p:'Control plane certificates are renewed by `kubeadm certs renew` or during `kubeadm upgrade` (see Section 11). For automation, schedule upgrades or renewals well before one-year expiry, and monitor `kubeadm certs check-expiration`.'},
{h:'Certificates for Pods'},
{p:'Workloads that need X.509 identities (for mutual TLS, for example) have usually relied on a service mesh, **cert-manager** or **SPIFFE/SPIRE**. Newer Kubernetes releases explore a built-in **Pod certificate** mechanism: a Pod requests a certificate through a `PodCertificateRequest` and the kubelet mounts the issued key and chain as a projected volume, rotating it automatically. This is an early feature; check its stage in the release notes before depending on it.'},
{code:`# Today: cert-manager issues and renews certificates as Secrets
apiVersion: cert-manager.io/v1
kind: Certificate
metadata: {name: api-tls, namespace: shop}
spec:
  secretName: api-tls
  dnsNames: [api.shop.svc.cluster.local]
  duration: 720h
  renewBefore: 240h
  issuerRef: {name: internal-ca, kind: ClusterIssuer}`},
{h:'Checklist'},
{ul:['Enable kubelet client rotation and serving-certificate bootstrap with an approval process.','Alert on certificates that will expire within 30 days, including application certificates.','Prefer **short-lived** certificates and tokens with automatic renewal over long-lived ones.','Document how to recover when everything has already expired (Section 11).']},
{note:'A rotation that is configured but never tested is the same as no rotation. Check on a lab cluster that new CSRs are created, approved and picked up before you rely on it.'}],
src:[['Certificate rotation',K.T+'tls/certificate-rotation/'],['TLS bootstrapping',K.R+'access-authn-authz/kubelet-tls-bootstrapping/'],['cert-manager','https://cert-manager.io/docs/']]};
})();
