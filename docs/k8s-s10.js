/* LearnSphere - Kubernetes Administrator, Section 10: Cluster Hardening & Policy.
   Lectures 0-5 are core, 6-11 are additional content (flagged in index.html). Needs k8s-common.js. */
(function(){
const K=window.K8S,L=window.LESSONS,C=K.C,T=K.T,R=K.R;
const SEC=C+'security/';

const psa=K.dg(700,200,[
[10,30,200,140,'Pod Security Standards|privileged: no limits|baseline: blocks known|escalations|restricted: hardened best practice',1],
[250,20,200,50,'enforce: reject violating Pods',2],[250,80,200,50,'audit: log violations',0],[250,140,200,50,'warn: show a warning to the user',0],
[490,60,200,80,'Namespace labels|pod-security.kubernetes.io/|enforce: restricted',2]],
[[450,45,490,85],[450,105,490,100],[450,165,490,115]]);

const enc=K.dg(700,200,[
[10,70,110,60,'kubectl|apply Secret',0],[160,70,130,60,'kube-apiserver|encrypts before write',2],[330,70,150,60,'EncryptionConfiguration|provider list:|aescbc / secretbox / kms',0],[520,70,170,60,'etcd|stores ciphertext|k8s:enc:aescbc:v1:key1',2]],
[[120,100,160,100],[290,100,330,100],[290,100,520,100]]);

/* ---------- 0: PSA ---------- */
L['k8s:9:0']={blocks:[
{p:'**Pod Security Admission (PSA)** is a built-in admission controller that checks Pods against the **Pod Security Standards** and is configured with **namespace labels**. It replaced PodSecurityPolicy, which was removed in v1.25.'},
{svg:psa},
{h:'The three profiles'},
{t:[['Profile','Meaning','Examples of what it blocks'],
['**privileged**','Unrestricted','Nothing. For system namespaces and trusted infrastructure only'],
['**baseline**','Prevents known privilege escalations; easy to adopt','`privileged: true`, `hostNetwork`, `hostPID`, `hostPath` volumes, dangerous capabilities, host ports'],
['**restricted**','Current hardening best practice','Everything in baseline plus: must run as non-root, must drop `ALL` capabilities, must set `seccompProfile`, `allowPrivilegeEscalation: false`']]},
{h:'The three modes'},
{ul:['**enforce**: violating Pods are rejected.','**audit**: allowed, but recorded in the audit log.','**warn**: allowed, but the user gets a warning in the response.']},
{code:`# Apply to a namespace with labels
kubectl label ns shop \\
  pod-security.kubernetes.io/enforce=baseline \\
  pod-security.kubernetes.io/enforce-version=latest \\
  pod-security.kubernetes.io/warn=restricted \\
  pod-security.kubernetes.io/audit=restricted

# Dry-run first: which existing Pods would violate restricted?
kubectl label --dry-run=server --overwrite ns shop pod-security.kubernetes.io/enforce=restricted`},
{h:'Rollout strategy'},
{flow:['Set audit and warn to the target profile on a namespace','Review warnings and audit events; fix workloads','Set enforce to the same profile','Repeat per namespace; keep kube-system privileged']},
{ul:['PSA checks **Pods**. Deployments are accepted, and the failure shows up when the ReplicaSet tries to create Pods (look at ReplicaSet events). Warnings do appear for workload objects too.','Existing Pods are not evicted when you change labels; only new Pods are checked.','You can set cluster-wide defaults and exemptions with an `AdmissionConfiguration` for the API server.','PSA offers three coarse levels. For custom rules use ValidatingAdmissionPolicy or a policy engine (later in this section).']},
{code:`kubectl -n shop run bad --image=nginx --privileged
# Error ... violates PodSecurity "baseline:latest": privileged (container "bad" must not set securityContext.privileged=true)`},
{note:'A reasonable default: `baseline` enforced with `restricted` in warn and audit for all application namespaces, and `restricted` enforced for new, well-behaved workloads.'}],
src:[['Pod Security Admission',SEC+'pod-security-admission/'],['Pod Security Standards',C+'security/pod-security-standards/'],['Enforce Pod Security Standards with Namespace Labels',T+'configure-pod-container/enforce-standards-namespace-labels/']]};

/* ---------- 1: Security contexts ---------- */
L['k8s:9:1']={blocks:[
{p:'A **securityContext** sets privilege and access controls on a Pod or an individual container. It is how you make a workload satisfy the `restricted` profile and shrink what an attacker gains from a compromised container.'},
{code:`apiVersion: v1
kind: Pod
metadata: {name: hardened}
spec:
  securityContext:                       # Pod level (applies to all containers)
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001                       # group ownership for mounted volumes
    seccompProfile: {type: RuntimeDefault}
  containers:
  - name: app
    image: myapp:2.1
    securityContext:                     # container level (overrides Pod level)
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
        # add: ["NET_BIND_SERVICE"]      # only if truly required
    volumeMounts:
    - {name: tmp, mountPath: /tmp}       # writable scratch because root fs is read-only
  volumes:
  - name: tmp
    emptyDir: {}`},
{t:[['Setting','What it prevents'],
['`runAsNonRoot` / `runAsUser`','Running as UID 0; limits damage from an escape and file access'],
['`allowPrivilegeEscalation: false`','Processes gaining more privilege than their parent (setuid binaries)'],
['`capabilities.drop: ["ALL"]`','Linux capabilities such as `NET_RAW` and `SYS_ADMIN`; add back only the ones needed'],
['`readOnlyRootFilesystem`','Malware writing to the container filesystem'],
['`seccompProfile: RuntimeDefault`','Dangerous system calls filtered by the runtime default profile'],
['`privileged: true`','Avoid: gives nearly full host access'],
['`fsGroup`','Volume file ownership so a non-root user can write']]},
{h:'Other security-related Pod settings'},
{ul:['`hostNetwork`, `hostPID`, `hostIPC`: leave `false`.','`hostPath` volumes expose the node; avoid.','Linux **AppArmor** and **SELinux** options add mandatory access control where your distribution supports them.','`automountServiceAccountToken: false` where the API is not needed.','Resource limits also protect the node from runaway containers.']},
{h:'Check what a container is doing'},
{code:`kubectl exec hardened -- id                        # uid=10001 gid=10001
kubectl exec hardened -- touch /etc/x              # read-only file system
kubectl exec hardened -- touch /tmp/ok             # works
kubectl get pod hardened -o jsonpath='{.spec.containers[0].securityContext}'`},
{ul:['Image runs as root and you set `runAsNonRoot: true`: the Pod fails with `container has runAsNonRoot and image will run as root`. Rebuild the image with a numeric `USER`, or set `runAsUser`.','App needs to write files: mount an `emptyDir` or PVC for the writable paths.','Ports below 1024 need `NET_BIND_SERVICE`; prefer listening on a high port and mapping with the Service.']},
{note:'Every setting above is a "dropped by default" improvement. Start with `runAsNonRoot`, `allowPrivilegeEscalation: false`, `drop: [ALL]`, seccomp RuntimeDefault and a read-only root filesystem, and relax only with a documented reason.'}],
src:[['Configure a Security Context for a Pod or Container',T+'configure-pod-container/security-context/'],['Linux kernel security constraints',SEC+'linux-kernel-security-constraints/']]};

/* ---------- 2: Secrets and encryption at rest ---------- */
L['k8s:9:2']={blocks:[
{p:'By default the API server stores Secrets **base64 encoded, not encrypted**, in etcd. Anyone with access to etcd, its disk or its backups can read them. **Encryption at rest** makes the API server encrypt resources before writing them.'},
{svg:enc},
{h:'EncryptionConfiguration'},
{code:`# /etc/kubernetes/enc/enc.yaml  (readable only by root)
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: ["secrets"]
  providers:
  - aescbc:                           # first provider is used to ENCRYPT new writes
      keys:
      - name: key1
        secret: <base64 of 32 random bytes>
  - identity: {}                      # last: still lets the server READ old plaintext data`},
{code:`head -c 32 /dev/urandom | base64          # generate a key

# API server manifest: mount the file and set the flag
#   --encryption-provider-config=/etc/kubernetes/enc/enc.yaml
#   volumeMounts / hostPath for /etc/kubernetes/enc
sudo vim /etc/kubernetes/manifests/kube-apiserver.yaml
kubectl get nodes                           # API server restarts; wait for it`},
{h:'Verify and migrate old data'},
{code:`# New Secrets are encrypted. Look at the raw etcd value:
kubectl create secret generic enc-test --from-literal=k=v
sudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\
  get /registry/secrets/default/enc-test | hexdump -C | head
# should start with  k8s:enc:aescbc:v1:key1   (not plaintext)

# Existing Secrets stay plaintext until rewritten:
kubectl get secrets -A -o json | kubectl replace -f -`},
{h:'Key rotation'},
{flow:['Add a new key as the FIRST entry; keep the old key second','Restart all API servers so every one can read both','Rewrite all Secrets so they are re-encrypted with the new key','Remove the old key after everything is rewritten']},
{h:'Providers'},
{t:[['Provider','Notes'],
['`identity`','No encryption (the default)'],
['`aescbc`','AES-CBC; local key stored in the config file, so protect the file'],
['`secretbox`','XSalsa20-Poly1305; strong and fast, also a local key'],
['`kms` (v2)','Data encryption keys protected by an external KMS or HSM (additional lecture); preferred for real clusters']]},
{ul:['The key in the config file sits on the control plane disk. Encryption at rest then protects **etcd backups and disk theft**, not someone who has root on the control plane. KMS improves this.','Do not lose the key: encrypted data cannot be read without it.','You can encrypt other resources too (`configmaps`, custom resources) by listing them.','Managed services (EKS, AKS, GKE) offer envelope encryption with the cloud KMS as an option you enable.']},
{note:'Encryption at rest does not hide Secrets from anyone who can `get secrets` through the API, and Secrets in Git or CI logs remain a risk. RBAC, namespace isolation and external secret managers complete the picture.'}],
src:[['Encrypting Confidential Data at Rest',T+'administer-cluster/encrypt-data/'],['Good practices for Kubernetes Secrets',SEC+'secrets-good-practices/'],['Secrets',C+'configuration/secret/']]};

/* ---------- 3: Admission and VAP ---------- */
L['k8s:9:3']={blocks:[
{p:'**Admission control** runs after authentication and authorization and before an object is stored. Admission plugins can **mutate** objects (add defaults, inject sidecars) and **validate** them (accept or reject).'},
{h:'Built-in and dynamic admission'},
{t:[['Kind','Examples'],
['Built-in plugins (compiled in)','`NamespaceLifecycle`, `LimitRanger`, `ResourceQuota`, `ServiceAccount`, `PodSecurity`, `DefaultStorageClass`'],
['Admission webhooks (your service)','`MutatingWebhookConfiguration`, `ValidatingWebhookConfiguration` call an HTTPS endpoint (Kyverno, Gatekeeper, Istio injection)'],
['Declarative CEL policies (no service to run)','`ValidatingAdmissionPolicy` + `ValidatingAdmissionPolicyBinding`']]},
{h:'ValidatingAdmissionPolicy'},
{p:'Rules are written in **CEL** (Common Expression Language) and evaluated inside the API server: no webhook to deploy, no network hop, no extra failure mode. It is stable in recent Kubernetes releases.'},
{code:`apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicy
metadata: {name: require-team-label}
spec:
  failurePolicy: Fail
  matchConstraints:
    resourceRules:
    - apiGroups: ["apps"]
      apiVersions: ["v1"]
      operations: ["CREATE", "UPDATE"]
      resources: ["deployments"]
  validations:
  - expression: "has(object.metadata.labels) && 'team' in object.metadata.labels"
    message: "Every Deployment must have a team label"
  - expression: "object.spec.replicas <= 20"
    messageExpression: "'replicas ' + string(object.spec.replicas) + ' exceeds the limit of 20'"
---
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingAdmissionPolicyBinding
metadata: {name: require-team-label-prod}
spec:
  policyName: require-team-label
  validationActions: [Deny]            # also: Warn, Audit
  matchResources:
    namespaceSelector:
      matchLabels: {environment: prod}`},
{ul:['**Policy** defines the rule; **Binding** decides where it applies and what happens (`Deny`, `Warn`, `Audit`).','Use `Warn` and `Audit` first to see what would break.','Parameters can live in a ConfigMap or custom resource (`paramKind`) so one policy serves many settings.','`object`, `oldObject`, `request` and `params` are available in expressions.']},
{code:`kubectl create deployment web --image=nginx -n shop   # in a prod-labelled namespace
# Error ... ValidatingAdmissionPolicy 'require-team-label' with binding 'require-team-label-prod' denied request: Every Deployment must have a team label

kubectl get validatingadmissionpolicy,validatingadmissionpolicybinding`},
{h:'Webhook caveats'},
{ul:['A webhook with `failurePolicy: Fail` that is down can **block all matching requests**, including those needed to repair the webhook. Exclude `kube-system` and the webhook own namespace.','Set tight `matchPolicy`, `namespaceSelector` and short `timeoutSeconds`.','Mutating webhooks run before validating ones; their order is not guaranteed relative to each other.']},
{note:'Choose the lightest tool that works: built-in PSA for Pod standards, ValidatingAdmissionPolicy for simple field rules, and a policy engine such as Kyverno or Gatekeeper for complex, mutating or reporting needs.'}],
src:[['Validating Admission Policy',R+'access-authn-authz/validating-admission-policy/'],['Admission Controllers',R+'access-authn-authz/admission-controllers/'],['Dynamic Admission Control',R+'access-authn-authz/extensible-admission-controllers/']]};

/* ---------- 4: Image security ---------- */
L['k8s:9:4']={blocks:[
{p:'Your cluster runs whatever images you tell it to. Image security reduces the chance that a vulnerable, tampered or surprise image runs in production.'},
{h:'Pull from private registries'},
{code:`kubectl create secret docker-registry regcred \\
  --docker-server=registry.example.com --docker-username=ci --docker-password="$REG_TOKEN" \\
  --docker-email=ci@example.com -n shop

# Per Pod
spec:
  imagePullSecrets: [{name: regcred}]

# Or once for every Pod using a ServiceAccount
kubectl patch serviceaccount default -n shop -p '{"imagePullSecrets":[{"name":"regcred"}]}'`},
{ul:['On cloud services prefer **workload identity** or node IAM roles (ECR, ACR, Artifact Registry) over static registry passwords.','Pull secrets are namespaced; create one per namespace that needs it.','Use a read-only registry credential; never reuse a push credential.']},
{h:'Pin images'},
{t:[['Reference','Behaviour'],
['`nginx` or `nginx:latest`','Changes under you; avoid'],
['`nginx:1.27.2`','A version tag; the publisher can still move it'],
['`nginx@sha256:3f1c...`','Immutable. The same bytes every time']]},
{code:`kubectl get pod web -o jsonpath='{.status.containerStatuses[0].imageID}'    # the digest actually running
imagePullPolicy: IfNotPresent      # default for tagged images; Always for :latest`},
{h:'Reduce attack surface'},
{ul:['Use **minimal base images** (distroless, scratch, Alpine) with no shell or package manager when possible.','Build **multi-stage** images so compilers and test tools never ship.','**Scan** images for known vulnerabilities in CI and in the registry (Trivy, Grype) and rebuild regularly.','Run as a **non-root** user with a numeric `USER`.','Keep secrets out of image layers; they are readable by anyone who can pull the image.']},
{h:'Control which images may run'},
{ul:['An **admission policy** can allow only images from approved registries.','**Signature verification** (Cosign with Kyverno or a verifying admission webhook) ensures an image came from your pipeline.','`ImagePolicyWebhook` or `AlwaysPullImages` admission plugins add API-server-side checks.']},
{code:`# ValidatingAdmissionPolicy expression: only our registry
validations:
- expression: "object.spec.template.spec.containers.all(c, c.image.startsWith('registry.example.com/'))"
  message: "Images must come from registry.example.com"`},
{note:'`AlwaysPullImages` matters in multi-tenant clusters: without it, a Pod can use an image already cached on a node without presenting credentials, bypassing pull-secret checks.'}],
src:[['Images',C+'containers/images/'],['Pull an Image from a Private Registry',T+'configure-pod-container/pull-image-private-registry/'],['Container Image Security',SEC+'#container']]};

/* ---------- 5: Audit and CIS ---------- */
L['k8s:9:5']={blocks:[
{p:'Two practices tell you **what happened** and **how hardened you are**: audit logging and benchmark scanning.'},
{h:'Audit logging'},
{p:'The API server can record a chronological log of requests: who did what, to which object, when, and what the outcome was. An **audit policy** decides what to log and at which level.'},
{t:[['Level','Records'],['`None`','Nothing'],['`Metadata`','User, verb, resource, time, response code; not bodies'],['`Request`','Metadata plus the request body'],['`RequestResponse`','Metadata plus request and response bodies (large)']]},
{code:`# /etc/kubernetes/audit/policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ["RequestReceived"]
rules:
- level: None                                   # drop noisy read-only health traffic
  nonResourceURLs: ["/healthz*", "/livez*", "/readyz*"]
- level: None
  users: ["system:kube-proxy"]
  verbs: ["watch"]
- level: Metadata                               # never log Secret contents
  resources:
  - {group: "", resources: ["secrets", "configmaps", "tokenreviews"]}
- level: RequestResponse                        # full detail for RBAC changes
  resources:
  - {group: "rbac.authorization.k8s.io"}
- level: Metadata                               # everything else`},
{code:`# kube-apiserver static Pod manifest additions
#   --audit-policy-file=/etc/kubernetes/audit/policy.yaml
#   --audit-log-path=/var/log/kubernetes/audit/audit.log
#   --audit-log-maxage=30  --audit-log-maxbackup=10  --audit-log-maxsize=100
# plus hostPath volumes and volumeMounts for the policy file and the log directory

sudo tail -n 2 /var/log/kubernetes/audit/audit.log | jq '{user:.user.username, verb:.verb, uri:.requestURI, code:.responseStatus.code}'
sudo jq 'select(.verb=="delete" and .objectRef.resource=="secrets")' /var/log/kubernetes/audit/audit.log`},
{ul:['Rules are evaluated **in order**; the first match decides the level.','Ship audit logs off the node to a central store; an attacker with node access can edit local files.','Managed services expose audit logs through their logging products (CloudWatch, Azure Monitor, Cloud Logging).','A bad flag or missing volume mount stops the API server from starting. Back up the manifest first.']},
{h:'CIS Kubernetes Benchmark and kube-bench'},
{p:'The **CIS Benchmark** is a consensus checklist for hardening Kubernetes components. **kube-bench** (Aqua Security) runs its checks against a node and reports PASS, FAIL, WARN and INFO with remediation text.'},
{code:`# On a control plane node (kubeadm); pick the benchmark that matches your version
kube-bench run --targets master
kube-bench run --targets node,etcd,policies

# As a Job inside the cluster
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench | grep -E "\\[FAIL\\]|== Summary"`},
{t:[['Typical finding','Fix'],
['`1.2.x` API server flag not set (audit, anonymous-auth, profiling)','Edit the static Pod manifest'],
['`4.2.x` kubelet settings (anonymous auth, read-only port)','Edit `/var/lib/kubelet/config.yaml` and restart the kubelet'],
['`1.1.x` file permissions on manifests and PKI','`chmod 600` / `chown root:root`'],
['`5.x` policies (network policies, namespaces, default SA)','Cluster configuration work']]},
{note:'Treat a scan as a starting point, not a pass mark. Some findings do not apply to managed clusters (you cannot edit the control plane), and some need a business decision. Record each exception and re-run the scan after upgrades.'}],
src:[['Auditing',C+'cluster-administration/audit/'],['Securing a Cluster',T+'administer-cluster/securing-a-cluster/'],['kube-bench','https://github.com/aquasecurity/kube-bench'],['CIS Kubernetes Benchmark','https://www.cisecurity.org/benchmark/kubernetes']]};
})();
