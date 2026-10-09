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
{p:'Kubernetes security is layered. The **4 Cs** model reminds you that a weak outer layer undermines everything inside it: a flaw in your code, container or cluster can bypass strong cloud controls, and vice versa.'},
{svg:layers},
{h:'Securing API access'},
{p:'Every request to the API server passes the same gates in the same order. Understanding them is the foundation for RBAC.'},
{flow:['Transport security: HTTPS on port 6443','Authentication: who are you?','Authorization: may you do this?','Admission control: is the request acceptable and valid?','Persist and respond']},
{t:[['Gate','Question','Fails with'],
['Authentication','Is this a known identity?','`401 Unauthorized`'],
['Authorization','Is that identity allowed this verb on this resource?','`403 Forbidden`'],
['Admission','Do policy and defaults accept this object?','`403`/`422` with an admission message']]},
{h:'Two kinds of subjects'},
{ul:['**Humans** (users and groups) are **not objects** in Kubernetes. Kubernetes does not store users; it trusts an external source (certificates, OIDC identity provider) and learns the user name and groups from each request.','**Service accounts** are Kubernetes objects that give identities to Pods and automation.']},
{h:'Authorization modes'},
{t:[['Mode','Use'],['`Node`','Lets each kubelet read only what its own Pods need'],['`RBAC`','The standard role-based system covered in this section'],['`Webhook`','Delegate decisions to an external service (additional lecture)'],['`AlwaysAllow` / `AlwaysDeny`','Testing only']]},
{code:`# See how a cluster is configured (kubeadm)
sudo grep -E "authorization-mode|client-ca-file|oidc|anonymous" /etc/kubernetes/manifests/kube-apiserver.yaml

# Who am I according to the API?
kubectl auth whoami
kubectl get --raw /apis/authentication.k8s.io/v1/selfsubjectreviews -v=6 2>/dev/null | head -n 1`},
{note:'Anonymous requests are authenticated as `system:anonymous` and normally get nothing under RBAC. Keep `--anonymous-auth` limited to what health checks need, and never grant roles to `system:anonymous` or `system:unauthenticated`.'}],
src:[['Security',SEC],['Controlling Access to the Kubernetes API',SEC+'controlling-access/'],['Cloud Native Security and Kubernetes',SEC+'cloud-native-security/']]};

/* ---------- 1: Authentication methods ---------- */
L['k8s:8:1']={blocks:[
{p:'The API server supports several **authenticators** at once. It tries each in turn; the first to accept a request wins and supplies a **username** and **groups**.'},
{t:[['Method','Who uses it','Notes'],
['**Client certificates (X.509)**','Admins, kubelets, control plane components','CN becomes the user name, O fields become groups. Cannot be revoked individually; expire by date.'],
['**Service account tokens (JWT)**','Pods and automation','Signed by the cluster; short-lived, audience-bound tokens are projected into Pods'],
['**OIDC tokens**','People via an identity provider (Entra ID, Google, Okta, Keycloak)','Best practice for humans: SSO, MFA, group claims, easy offboarding'],
['**Webhook token**','Custom or cloud identity systems','API server calls an external service to validate bearer tokens'],
['**Bootstrap tokens**','Node joining (kubeadm)','Short lived, narrow permissions'],
['Static token file, basic auth','(do not use)','Static credentials; basic auth was removed']]},
{h:'How a certificate identity looks'},
{code:`openssl x509 -in /etc/kubernetes/pki/apiserver-kubelet-client.crt -noout -subject
# subject=O = kubeadm:cluster-admins, CN = kube-apiserver-kubelet-client

# the admin kubeconfig identity
kubectl config view --raw -o jsonpath='{.users[0].user.client-certificate-data}' | base64 -d | openssl x509 -noout -subject
# subject=O = kubeadm:cluster-admins, CN = kubernetes-admin`},
{ul:['Whoever holds a certificate with group `system:masters` is **always cluster admin** and bypasses RBAC. Never issue it for people.','Modern kubeadm gives the admin credential a `kubeadm:cluster-admins` group bound through RBAC, so access can be revoked by deleting the binding.']},
{h:'Using other credentials with kubectl'},
{code:`kubectl --token=<bearer-token> get pods
kubectl config set-credentials alice --client-certificate=alice.crt --client-key=alice.key
kubectl config set-credentials ci --token=<token>
# OIDC via the kubelogin plugin (exec credential plugin)
kubectl config set-credentials oidc --exec-api-version=client.authentication.k8s.io/v1 \\
  --exec-command=kubectl --exec-arg=oidc-login --exec-arg=get-token ...`},
{h:'Managed services'},
{p:'EKS maps AWS IAM identities to Kubernetes users and groups, AKS integrates with Entra ID, and GKE with Google identities. The mapping lives in provider configuration; **RBAC still decides what those identities may do**.'},
{note:'Prefer short-lived credentials for people (OIDC) and automation (projected service account tokens or cloud workload identity). Long-lived client certificates and tokens leak and are hard to revoke.'}],
src:[['Authenticating',AA+'authentication/'],['Certificates and Certificate Signing Requests',AA+'certificate-signing-requests/']]};

/* ---------- 2: Users and CSR ---------- */
L['k8s:8:2']={blocks:[
{p:'Since Kubernetes has no user objects, "creating a user" means giving a person a **certificate** signed by the cluster CA with their name in it. The **CertificateSigningRequest (CSR) API** lets an admin approve it without handing out the CA key.'},
{flow:['User generates a private key','User creates a certificate signing request file (openssl) with CN=name, O=group','Admin creates a CertificateSigningRequest object','Admin approves it; the controller manager signs it','Admin extracts the signed certificate','Build a kubeconfig; grant permissions with RBAC']},
{h:'1. Key and request'},
{code:`openssl genrsa -out jane.key 2048
openssl req -new -key jane.key -out jane.csr -subj "/CN=jane/O=dev-team"
base64 -w0 jane.csr          # use  base64 | tr -d '\\n'  on macOS`},
{h:'2. Submit and approve'},
{code:`cat <<EOF | kubectl apply -f -
apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: jane
spec:
  request: $(base64 -w0 jane.csr)
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: 86400            # 1 day
  usages: [client auth]
EOF
kubectl get csr                       # Pending
kubectl certificate approve jane
kubectl get csr jane                  # Approved,Issued`},
{h:'3. Fetch the certificate and build a kubeconfig'},
{code:`kubectl get csr jane -o jsonpath='{.status.certificate}' | base64 -d > jane.crt

kubectl config set-credentials jane --client-certificate=jane.crt --client-key=jane.key --embed-certs=true
kubectl config set-context jane@lab --cluster=<cluster-name> --user=jane --namespace=dev
kubectl --context jane@lab get pods
# Error from server (Forbidden): pods is forbidden: User "jane" cannot list resource "pods"`},
{p:'Jane is **authenticated** (the API knows who she is) but not **authorized**. That is exactly right until you create RBAC bindings in the next lectures.'},
{ul:['`signerName: kubernetes.io/kube-apiserver-client` is for client certificates. Kubelet and serving certificates use different signers.','`expirationSeconds` shortens the lifetime (minimum 10 minutes); keep user certificates short.','Deny a request with `kubectl certificate deny`. Delete finished CSR objects to keep the list tidy.','Group membership comes from the **O** fields in the subject.']},
{note:'There is no certificate revocation list in Kubernetes. To cut off a certificate user before expiry, remove their RBAC bindings (and any group bindings) so the certificate authenticates but has no rights.'}],
src:[['Certificates and Certificate Signing Requests',AA+'certificate-signing-requests/'],['Manage TLS Certificates',T+'tls/managing-tls-in-a-cluster/'],['Certificate signing request API',R+'kubernetes-api/authentication-resources/certificate-signing-request-v1/']]};

/* ---------- 3: Service accounts ---------- */
L['k8s:8:3']={blocks:[
{p:'A **ServiceAccount** is the identity of a workload. Every Pod runs as one; the default is the namespace `default` ServiceAccount.'},
{code:`kubectl create serviceaccount app-sa -n shop
kubectl -n shop get sa
# in the Pod spec
spec:
  serviceAccountName: app-sa
  automountServiceAccountToken: false      # do not mount an API token unless the app calls the API`},
{h:'Projected, short-lived tokens'},
{p:'Current Kubernetes mounts a **projected** token into the Pod at `/var/run/secrets/kubernetes.io/serviceaccount/token`. It is a signed JWT that is **time-limited** (the kubelet refreshes it), **audience-bound** and **bound to the Pod**: it becomes invalid when the Pod is deleted.'},
{code:`kubectl -n shop exec app -- cat /var/run/secrets/kubernetes.io/serviceaccount/token | cut -d. -f2 | base64 -d 2>/dev/null
# {"aud":["https://kubernetes.default.svc"],"exp":...,"kubernetes.io":{"namespace":"shop","pod":{"name":"app"},"serviceaccount":{"name":"app-sa"}},"sub":"system:serviceaccount:shop:app-sa"}

# A token for use outside the cluster, with a limited lifetime
kubectl -n shop create token app-sa --duration=1h`},
{ul:['The identity looks like `system:serviceaccount:<namespace>:<name>`, with group `system:serviceaccounts:<namespace>`.','Request a token with a custom audience in a `projected` volume (`serviceAccountToken` source) to authenticate to other systems such as Vault or cloud IAM (workload identity).']},
{h:'Long-lived token Secrets are discouraged'},
{ul:['Old clusters auto-created a **never-expiring token Secret** for every ServiceAccount. Since v1.24 this does not happen.','You can still create one manually (`type: kubernetes.io/service-account-token`), but it never expires and leaks easily. Prefer `kubectl create token` or projected tokens.','Audit existing ones: `kubectl get secrets -A --field-selector type=kubernetes.io/service-account-token`.']},
{h:'Hardening checklist'},
{ul:['Create a **dedicated ServiceAccount per application**; do not use `default` for anything that needs permissions.','Disable token automount where the application does not call the API.','Grant the account only what it needs (next lecture); the `default` account should have **no** bindings.','`imagePullSecrets` can also be attached to a ServiceAccount so Pods using it pull from a private registry.']},
{note:'A Pod that can read its own ServiceAccount token can use any permission that account has. An attacker who gets a shell in a Pod can do the same, which is why least privilege and `automountServiceAccountToken: false` matter.'}],
src:[['Service Accounts',SEC+'service-accounts/'],['Configure Service Accounts for Pods',T+'configure-pod-container/configure-service-account/'],['Managing Service Accounts',AA+'service-accounts-admin/']]};

/* ---------- 4: RBAC ---------- */
L['k8s:8:4']={blocks:[
{p:'**Role-Based Access Control (RBAC)** decides what an authenticated subject may do. Permissions are **additive**: there are no deny rules, and no access unless a rule grants it.'},
{svg:rbac},
{h:'The four objects'},
{t:[['Object','Scope','Meaning'],
['**Role**','One namespace','A set of permission rules in that namespace'],
['**ClusterRole**','Cluster','Rules for cluster-scoped resources (nodes, PVs), for non-resource URLs, or reusable rules for any namespace'],
['**RoleBinding**','One namespace','Grants a Role **or ClusterRole** to subjects in that namespace only'],
['**ClusterRoleBinding**','Cluster','Grants a ClusterRole to subjects across the whole cluster']]},
{h:'Rules'},
{code:`apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: pod-reader, namespace: dev}
rules:
- apiGroups: [""]                       # "" = core group
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch", "update", "patch"]
  resourceNames: ["web"]                # only this named object
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata: {name: jane-pod-reader, namespace: dev}
subjects:
- {kind: User, name: jane, apiGroup: rbac.authorization.k8s.io}
- {kind: Group, name: dev-team, apiGroup: rbac.authorization.k8s.io}
- {kind: ServiceAccount, name: app-sa, namespace: dev}
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io`},
{ul:['**Verbs**: `get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, `deletecollection`, plus special ones such as `bind`, `escalate`, `impersonate`.','**Resources** include subresources such as `pods/log`, `pods/exec`, `deployments/scale`.','`roleRef` is **immutable**: to change which role a binding points to, delete and recreate it.','Use `list` and `watch` carefully: they can reveal full object contents (for example every Secret in a namespace).']},
{code:`# Imperative forms (fast)
kubectl create role pod-reader --verb=get,list,watch --resource=pods -n dev
kubectl create rolebinding jane-pod-reader --role=pod-reader --user=jane -n dev
kubectl create clusterrole node-viewer --verb=get,list --resource=nodes
kubectl create clusterrolebinding jane-nodes --clusterrole=node-viewer --user=jane

kubectl get roles,rolebindings -n dev
kubectl describe clusterrole view`},
{h:'Built-in ClusterRoles'},
{t:[['Role','Grants'],['`cluster-admin`','Everything, everywhere'],['`admin`','Full control inside a namespace (when bound with a RoleBinding), including roles'],['`edit`','Read and write most objects in a namespace, but not roles or bindings'],['`view`','Read-only on most objects, but **not Secrets**']]},
{note:'Binding `cluster-admin` is the quickest fix and the biggest risk. A common safe pattern is a RoleBinding to the built-in `edit` or `view` ClusterRole per namespace. Beware of **privilege escalation** paths: the ability to create Pods, read Secrets or bind roles is often equivalent to admin.'}],
src:[['Using RBAC Authorization',AA+'rbac/'],['RBAC Good Practices',SEC+'rbac-good-practices/']]};

/* ---------- 5: can-i ---------- */
L['k8s:8:5']={blocks:[
{p:'`kubectl auth can-i` asks the API server whether a request would be authorized. It is the fastest way to test RBAC and to debug a `Forbidden` error.'},
{code:`kubectl auth can-i create deployments -n dev
kubectl auth can-i delete pods --all-namespaces
kubectl auth can-i '*' '*'                          # am I cluster admin?

# As another identity (needs impersonate permission)
kubectl auth can-i list secrets -n dev --as jane
kubectl auth can-i get pods -n dev --as jane --as-group dev-team
kubectl auth can-i get pods -n dev --as system:serviceaccount:dev:app-sa

# List everything an identity may do in a namespace
kubectl auth can-i --list -n dev --as jane`},
{h:'Reading a Forbidden error'},
{code:`Error from server (Forbidden): pods is forbidden:
  User "jane" cannot list resource "pods" in API group "" in the namespace "prod"`},
{p:'The message names all four pieces you need: the **user** (and groups if shown), the **verb** (`list`), the **resource and API group** (`pods`, `""`) and the **namespace**. Compare each with your Role and RoleBinding.'},
{h:'Debug checklist'},
{ul:['Is the identity what you think? `kubectl auth whoami` (or check the certificate subject).','Is there a binding for that user **or one of its groups** in the **right namespace**?','Does the Role include the **exact verb**, **resource** and **API group**? `deployments` live in `apps`, not the core group.','Subresources are separate: `pods/exec` is not covered by `pods`.','Does the binding point to the Role you expect (`kubectl describe rolebinding`)?','`resourceNames` restrictions do not work with `list`, `watch` or `create`.']},
{code:`kubectl get rolebinding,clusterrolebinding -A -o wide | grep -E "jane|dev-team"
kubectl describe rolebinding jane-pod-reader -n dev
kubectl get clusterrolebinding -o json | \\
  jq -r '.items[] | select(.subjects[]? | .name=="jane") | .metadata.name'`},
{note:'If the API server uses `Node,RBAC`, a denial from RBAC returns 403 with no hint about which rule is missing. `can-i --list` and describing bindings are the debugging tools, not logs. Audit logs (Section 10) show every decision when you need them.'}],
src:[['kubectl auth can-i',R+'kubectl/generated/kubectl_auth/kubectl_auth_can-i/'],['Checking API Access',AA+'authorization/#checking-api-access']]};

/* ---------- 6: Practical ---------- */
L['k8s:8:6']={blocks:[
{p:'Lab: give a team access to one namespace with the minimum permissions, test the boundaries and tighten what was too broad.'},
{h:'Scenario'},
{p:'The `dev-team` group may deploy and inspect workloads in namespace `dev`, read (but not modify) Pods in `prod`, and must never read Secrets anywhere.'},
{h:'1. Namespaces and a service account for CI'},
{code:`kubectl create ns dev; kubectl create ns prod
kubectl -n dev create sa ci-deployer
kubectl -n dev create deployment web --image=nginx:1.27`},
{h:'2. Team role in dev'},
{code:`cat <<EOF | kubectl apply -f -
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata: {name: app-deployer, namespace: dev}
rules:
- apiGroups: ["", "apps"]
  resources: ["pods", "pods/log", "services", "deployments", "replicasets", "configmaps"]
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
{h:'3. Read-only in prod'},
{code:`kubectl -n prod create role pod-viewer --verb=get,list,watch --resource=pods,pods/log
kubectl -n prod create rolebinding dev-team-prod-view --role=pod-viewer --group=dev-team`},
{h:'4. Test the boundaries'},
{code:`kubectl auth can-i create deployments -n dev  --as jane --as-group dev-team   # yes
kubectl auth can-i delete pods         -n prod --as jane --as-group dev-team   # no
kubectl auth can-i list pods           -n prod --as jane --as-group dev-team   # yes
kubectl auth can-i get secrets         -n dev  --as jane --as-group dev-team   # no
kubectl auth can-i list pods           -n kube-system --as jane --as-group dev-team   # no
kubectl auth can-i create deployments -n dev --as system:serviceaccount:dev:ci-deployer   # yes
kubectl auth can-i --list -n dev --as jane --as-group dev-team`},
{h:'5. Find and fix over-broad access'},
{code:`# Someone made a shortcut. Find cluster-admin bindings:
kubectl create clusterrolebinding oops --clusterrole=cluster-admin --group=dev-team
kubectl get clusterrolebinding -o wide | grep cluster-admin
kubectl auth can-i get secrets -n prod --as jane --as-group dev-team       # now yes: bad

kubectl delete clusterrolebinding oops
kubectl auth can-i get secrets -n prod --as jane --as-group dev-team       # no again`},
{ul:['Why does the CI service account need only a Role in `dev` and not a ClusterRole?','Which verbs on which resource let a user reach Secrets indirectly? (Hint: creating a Pod that mounts one.)','What does `can-i --list` show that a single check does not?']},
{h:'Clean up'},
{code:`kubectl delete ns dev prod`}],
src:[['Using RBAC Authorization',AA+'rbac/'],['RBAC Good Practices',SEC+'rbac-good-practices/']]};
})();
