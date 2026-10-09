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
{p:'By default a Pod may ask for almost anything: run as root, mount the host filesystem, use the host network, add powerful Linux capabilities. If a workload like that is compromised, the attacker has the node. **Pod Security Admission (PSA)** is the built-in guardrail: an admission controller that checks every new Pod against three standard **profiles**, configured simply by **labelling a namespace**. It replaced PodSecurityPolicy, which was removed in v1.25.'},
{svg:psa},
{h:'The three profiles'},
{t:[['Profile','Idea','What it blocks (examples)','Use for'],
['**privileged**','Unrestricted','Nothing','Trusted system components: CNI, CSI, monitoring agents'],
['**baseline**','Stops **known privilege escalations**, still easy to adopt','`privileged: true`, `hostNetwork`, `hostPID`, `hostIPC`, `hostPath` volumes, host ports, dangerous capabilities, unsafe `procMount`, unsafe sysctls','Default for most application namespaces'],
['**restricted**','Current **hardening best practice**','Everything in baseline plus: must run as **non-root**, must set `allowPrivilegeEscalation: false`, must **drop ALL capabilities**, must use a `seccompProfile` (RuntimeDefault or Localhost), restricted volume types','Security-sensitive and new workloads']]},
{h:'The three modes'},
{t:[['Mode','When a Pod violates the profile'],
['`enforce`','The Pod is **rejected**'],
['`audit`','The Pod is **allowed**; the violation is recorded in the audit log'],
['`warn`','The Pod is **allowed**; the user receives a warning in the response']]},
{p:'Each mode is set independently by a label on the namespace, and each can use a different profile and Kubernetes version. This is how you roll out gradually: **warn and audit at `restricted`, enforce at `baseline`**.'},
{code:`kubectl label ns shop \\
  pod-security.kubernetes.io/enforce=baseline \\
  pod-security.kubernetes.io/enforce-version=latest \\
  pod-security.kubernetes.io/warn=restricted \\
  pod-security.kubernetes.io/audit=restricted

$ kubectl get ns shop --show-labels
$ kubectl -n shop run bad --image=nginx --privileged
Error from server (Forbidden): pods "bad" is forbidden: violates PodSecurity "baseline:latest": privileged (container "bad" must not set securityContext.privileged=true)
$ kubectl -n shop run ok --image=nginx
Warning: would violate PodSecurity "restricted:latest": allowPrivilegeEscalation != false (container "ok" must set securityContext.allowPrivilegeEscalation=false), unrestricted capabilities (container "ok" must set securityContext.capabilities.drop=["ALL"]), runAsNonRoot != true, seccompProfile ...
pod/ok created                                     # allowed by baseline, with a warning against restricted`},
{h:'Rolling it out safely'},
{flow:['Set warn and audit to the target profile on a namespace (no impact on users)','Collect warnings and audit events; fix workloads (Section 10 security contexts)','Dry-run the stricter enforce label: kubectl label --dry-run=server --overwrite ns shop pod-security.kubernetes.io/enforce=restricted','Set enforce on that namespace','Repeat per namespace; keep kube-system on privileged']},
{code:`# What would break if I enforced restricted now? (the server lists existing Pods that violate it)
kubectl label --dry-run=server --overwrite ns shop pod-security.kubernetes.io/enforce=restricted`},
{h:'What PSA does and does not cover'},
{ul:['It checks **Pods** (and the Pod templates inside Deployments, Jobs and so on **for warnings**). A Deployment is accepted, and the failure appears when its ReplicaSet tries to create Pods: look at **ReplicaSet events**.','Existing running Pods are **not** evicted when you change labels; only new Pods are checked.','Namespace-wide defaults and **exemptions** (users, runtime classes, namespaces) are set in the API server `AdmissionConfiguration`.','PSA is deliberately coarse: three levels. For custom rules (allowed registries, required labels) use ValidatingAdmissionPolicy or a policy engine.']},
{h:'Diagnosing a rejected Deployment'},
{code:`$ kubectl -n shop get deploy api
NAME   READY   UP-TO-DATE   AVAILABLE
api    0/2     0            0
$ kubectl -n shop describe rs -l app=api | grep -A3 Events
  Warning  FailedCreate  replicaset-controller  Error creating: pods "api-xxx" is forbidden: violates PodSecurity "restricted:latest": runAsNonRoot != true (container "api" must set securityContext.runAsNonRoot=true)`},
{t:[['Violation message','Fix in the Pod spec'],
['`privileged`','Remove `privileged: true`'],
['`hostNetwork`, `hostPID`, `hostPath volumes`','Remove or move to a privileged namespace if truly required'],
['`allowPrivilegeEscalation != false`','Set `allowPrivilegeEscalation: false`'],
['`unrestricted capabilities`','`capabilities: {drop: ["ALL"]}`'],
['`runAsNonRoot != true`','`runAsNonRoot: true` and a numeric `runAsUser`'],
['`seccompProfile`','`seccompProfile: {type: RuntimeDefault}`']]},
{note:'A sensible default: `baseline` enforced and `restricted` in warn and audit for application namespaces; `restricted` enforced for new, well-behaved workloads; `privileged` only for the few system namespaces that need it.'}],
src:[['Pod Security Admission',SEC+'pod-security-admission/'],['Pod Security Standards',C+'security/pod-security-standards/'],['Enforce Pod Security Standards with Namespace Labels',T+'configure-pod-container/enforce-standards-namespace-labels/']]};

/* ---------- 1: Security contexts ---------- */
L['k8s:9:1']={blocks:[
{p:'A **securityContext** is how a Pod or container declares **which privileges it needs**, and how you strip away the ones it does not. It is the practical half of Pod Security: PSA decides what is allowed, and the security context is what you write so that your workload qualifies. Each setting closes a specific attack path, and understanding the path tells you why it is worth the effort.'},
{h:'The settings and what each prevents'},
{t:[['Setting','What it controls','Attack it limits'],
['`runAsNonRoot: true`, `runAsUser: 10001`','Process UID inside the container','Root in the container can write root-owned files, load tools, and has far more kernel attack surface'],
['`allowPrivilegeEscalation: false`','Whether a process can gain more privilege than its parent (setuid binaries, `no_new_privs`)','Local privilege escalation inside the container'],
['`capabilities.drop: ["ALL"]` (add back only what is needed)','Linux capabilities (fine-grained root powers such as `NET_RAW`, `SYS_ADMIN`)','Network sniffing, mounting filesystems, kernel interaction'],
['`readOnlyRootFilesystem: true`','Root filesystem is read-only','Malware and tools dropped to disk, tampering with binaries'],
['`seccompProfile: RuntimeDefault`','Which system calls are allowed (runtime default filter)','Kernel exploits through rare system calls'],
['`privileged: true`','Gives nearly all host powers','**Avoid**: close to root on the node'],
['`fsGroup`, `supplementalGroups`','Group ownership of volumes','Lets a non-root user write to mounted storage'],
['`seLinuxOptions`, `appArmorProfile`','Mandatory access control where available','Containers reaching files or resources they should not']]},
{h:'Pod level versus container level'},
{code:`apiVersion: v1
kind: Pod
metadata: {name: hardened}
spec:
  securityContext:                       # Pod level: applies to all containers (and volumes)
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile: {type: RuntimeDefault}
  containers:
  - name: app
    image: myapp:2.1
    securityContext:                     # container level: overrides the Pod level for this container
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities: {drop: ["ALL"]}
    volumeMounts:
    - {name: tmp, mountPath: /tmp}       # the app needs a writable place: give it a volume
  volumes:
  - name: tmp
    emptyDir: {}`},
{h:'Proving it works from the inside'},
{code:`$ kubectl exec hardened -- id
uid=10001 gid=10001 groups=10001            # not root
$ kubectl exec hardened -- touch /etc/test
touch: /etc/test: Read-only file system     # read-only root
$ kubectl exec hardened -- touch /tmp/ok    # the writable volume works
$ kubectl exec hardened -- cat /proc/1/status | grep -E "CapEff|NoNewPrivs"
CapEff: 0000000000000000                    # no effective capabilities
NoNewPrivs: 1
$ kubectl get pod hardened -o jsonpath='{.spec.containers[0].securityContext}{"\\n"}'`},
{h:'The usual friction and how to solve it'},
{t:[['Error or symptom','Cause','Fix'],
['`container has runAsNonRoot and image will run as root`','The image defines no numeric user','Rebuild with a numeric `USER 10001`, or set `runAsUser`'],
['`permission denied` writing a file','Non-root user and a root-owned path or volume','`fsGroup`, correct ownership in the image, or an `emptyDir`'],
['`read-only file system` errors','App writes to the image filesystem (logs, temp, caches)','Mount `emptyDir` at those paths; log to stdout'],
['Cannot bind to port 80 or 443','Ports below 1024 need a capability for non-root','Listen on 8080 and map with the Service, or add `NET_BIND_SERVICE`'],
['Tool needing a capability fails (ping, mount)','Capability dropped','Add only that one back, if justified']]},
{h:'Other Pod settings with security impact'},
{ul:['`hostNetwork`, `hostPID`, `hostIPC`: keep `false`.','`hostPath` volumes: avoid; read-only if unavoidable.','`automountServiceAccountToken: false` when the app does not call the API.','**Resource limits** also protect the node from a runaway container.','**Sysctls**: only safe ones may be set in the Pod; unsafe sysctls need node configuration.']},
{h:'Common mistakes'},
{ul:['Setting `runAsNonRoot: true` and forgetting that the image still starts as root: Pod fails to start.','Using `privileged: true` to fix a permission problem instead of fixing the permission.','Dropping capabilities but leaving `allowPrivilegeEscalation` unset (the default allows it).','Applying only Pod-level settings when a container must override them, or the reverse.']},
{note:'Start with the five that cost almost nothing: `runAsNonRoot`, `allowPrivilegeEscalation: false`, `drop: [ALL]`, `seccompProfile: RuntimeDefault` and a read-only root filesystem with writable volumes where needed. Relax only with a documented reason.'}],
src:[['Configure a Security Context for a Pod or Container',T+'configure-pod-container/security-context/'],['Linux kernel security constraints',SEC+'linux-kernel-security-constraints/']]};

/* ---------- 2: Secrets and encryption at rest ---------- */
L['k8s:9:2']={blocks:[
{p:'Secrets are the most sensitive objects in a cluster: database passwords, API keys, TLS private keys, registry credentials. A common misunderstanding is that a Kubernetes Secret is "encrypted". **By default it is not**: the API server stores it in etcd as **base64-encoded** text. Anyone who can read etcd, its disk or a backup can recover every Secret. **Encryption at rest** makes the API server encrypt selected resources before writing them to etcd.'},
{svg:enc},
{h:'Proving the default'},
{code:`$ kubectl create secret generic demo --from-literal=password=S3cr3t!
$ sudo ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 \\
    --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key \\
    get /registry/secrets/default/demo | strings | grep -i secret
S3cr3t!                                         # readable straight from etcd`},
{h:'EncryptionConfiguration'},
{code:`# /etc/kubernetes/enc/enc.yaml  (root only)
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: ["secrets"]
  providers:
  - aescbc:                           # FIRST provider encrypts every new write
      keys:
      - name: key1
        secret: <base64 of 32 random bytes>
  - identity: {}                      # LAST: lets the server still READ old unencrypted data`},
{ul:['Providers are tried **in order**. The **first** is used to encrypt; **all** listed providers can decrypt. `identity` means "no encryption".','Keep `identity` **last** during migration so existing plaintext Secrets remain readable. Once everything is rewritten, you may remove it.','Other resources (ConfigMaps, custom resources) can be listed too.']},
{h:'Turning it on (kubeadm)'},
{flow:['Generate a 32 byte key: head -c 32 /dev/urandom | base64','Write the configuration file on every control plane node (root readable only)','Mount the file into the kube-apiserver static Pod (hostPath volume and volumeMount)','Add --encryption-provider-config=/etc/kubernetes/enc/enc.yaml to the API server flags','The kubelet restarts the API server; wait until kubectl works again','Create a new Secret, then verify it is encrypted in etcd','Rewrite all existing Secrets so they are encrypted too']},
{code:`$ sudo ETCDCTL_API=3 etcdctl ... get /registry/secrets/default/new | hexdump -C | head -n 3
00000000  2f 72 65 67 69 73 74 72  79 2f 73 65 63 72 65 74  |/registry/secret|
00000010  73 2f 64 65 66 61 75 6c  74 2f 6e 65 77 0a 6b 38  |s/default/new.k8|
00000020  73 3a 65 6e 63 3a 61 65  73 63 62 63 3a 76 31 3a  |s:enc:aescbc:v1:|      # k8s:enc:aescbc:v1:key1 prefix: encrypted

# existing Secrets stay plaintext until they are written again
$ kubectl get secrets -A -o json | kubectl replace -f -`},
{h:'Providers compared'},
{t:[['Provider','Where the key lives','Notes'],
['`identity`','None','No encryption (default)'],
['`aescbc`','In the configuration file on the control plane','AES-CBC; protects etcd disks and backups, not a root user on the control plane'],
['`secretbox`','In the configuration file','XSalsa20-Poly1305; strong and fast, also a local key'],
['`kms` (v2)','In an **external KMS or HSM**','Envelope encryption; preferred for production (additional lecture)']]},
{h:'Key rotation'},
{flow:['Add a new key as the FIRST entry; keep the old key second','Restart all API servers so every instance can read both','Rewrite all Secrets so they are re-encrypted with the new key','Remove the old key after everything is rewritten and verified']},
{h:'What encryption at rest does not do'},
{ul:['It does **not** hide Secrets from anyone who can `get secrets` through the API: use RBAC.','A **local key** sits on the control plane disk, so root on that node can read it. KMS improves this.','Secrets in Git, CI logs, environment dumps and backups of the application remain your responsibility.','**Losing the key means losing the data**: back up the configuration securely.','Managed services (EKS, AKS, GKE) offer envelope encryption with the cloud KMS as an option to enable.']},
{h:'Other good Secret practices'},
{t:[['Practice','Why'],
['Restrict RBAC for `secrets` (`get`, `list`, `watch`)','`list` returns every Secret value in the namespace'],
['Mount Secrets as files, not environment variables','Env vars leak through process listings and crash dumps'],
['Use an external manager (External Secrets, Secrets Store CSI, Vault)','Central rotation, audit and revocation'],
['Never commit Secret YAML','Use SOPS or Sealed Secrets for GitOps'],
['Short-lived credentials where possible','Limits the value of a leak']]},
{note:'Exam tip: the encryption task is: write the EncryptionConfiguration, mount it into the API server manifest, add the flag, wait for the API server, create a Secret and verify it with `etcdctl` that the value starts with `k8s:enc:`.'}],
src:[['Encrypting Confidential Data at Rest',T+'administer-cluster/encrypt-data/'],['Good practices for Kubernetes Secrets',SEC+'secrets-good-practices/'],['Secrets',C+'configuration/secret/']]};

/* ---------- 3: Admission and VAP ---------- */
L['k8s:9:3']={blocks:[
{p:'Authentication says who you are and RBAC says what you may do, but neither inspects **what is inside the object** you are creating. **Admission control** does. It runs after authorization and before the object is stored, and it can **change** the object (mutating) or **reject** it (validating). It enforces rules such as "every Pod must set limits", "images only from our registry" or "Deployments need an owner label".'},
{h:'Where admission sits'},
{flow:['Request authenticated and authorized','Mutating admission: plugins and webhooks may modify the object (defaults, injected sidecars)','Schema validation of the resulting object','Validating admission: plugins, policies and webhooks may reject it','The object is persisted to etcd']},
{t:[['Kind','Examples','Where it runs'],
['**Built-in plugins**','`NamespaceLifecycle`, `LimitRanger`, `ResourceQuota`, `ServiceAccount`, `PodSecurity`, `DefaultStorageClass`, `NodeRestriction`','Inside the API server'],
['**Admission webhooks**','Policy engines (Kyverno, Gatekeeper), sidecar injectors (service meshes)','**Your service** called over HTTPS'],
['**ValidatingAdmissionPolicy**','CEL rules you write as YAML','Inside the API server, **no webhook service to run**']]},
{h:'ValidatingAdmissionPolicy: rules without a webhook'},
{p:'A policy states **what to match** and **which CEL expressions must be true**. A separate **binding** decides **where** it applies and **what happens on violation** (deny, warn or audit). Because it runs inside the API server there is no network call and no extra component that can be down.'},
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
  validationActions: [Deny]              # also Warn, Audit
  matchResources:
    namespaceSelector: {matchLabels: {environment: prod}}`},
{code:`$ kubectl -n shop create deployment web --image=nginx            # shop is labelled environment=prod
error: failed to create deployment: deployments.apps "web" is forbidden: ValidatingAdmissionPolicy 'require-team-label' with binding 'require-team-label-prod' denied request: Every Deployment must have a team label
$ kubectl get validatingadmissionpolicy,validatingadmissionpolicybinding`},
{ul:['In expressions, `object` is the new object, `oldObject` the previous one (on update), `request` the request attributes and `params` optional parameters.','Start with `validationActions: [Warn]` or `[Audit]` to see impact before switching to `Deny`.','The expression language is CEL: `has()`, `in`, `all()`, `exists()`, `startsWith()`, string and list functions.']},
{h:'Admission webhooks and their dangers'},
{t:[['Risk','What happens','Mitigation'],
['Webhook unavailable with `failurePolicy: Fail`','All matching requests are rejected, possibly blocking the cluster','Run several replicas; exclude `kube-system` and the webhook own namespace'],
['Slow webhook','Every matching request waits','Short `timeoutSeconds`, narrow `rules`'],
['Expired webhook certificate','Silent failures','Automate certificates (cert-manager)'],
['Mutation conflicts','Two webhooks edit the same field','Idempotent mutations, `reinvocationPolicy`']]},
{h:'Choosing the right tool'},
{t:[['Need','Use'],
['Standard Pod hardening','Pod Security Admission'],
['Simple field rules, required labels, limits','ValidatingAdmissionPolicy'],
['Defaults and injection with logic','Mutating policy or webhook'],
['Complex logic, reports, generation, image verification','A policy engine (Kyverno, Gatekeeper)'],
['Resource quotas and defaults','ResourceQuota and LimitRange']]},
{h:'Debugging an admission rejection'},
{code:`# The error message names the plugin, policy or webhook that rejected it
kubectl get validatingwebhookconfigurations,mutatingwebhookconfigurations
kubectl get validatingadmissionpolicy,validatingadmissionpolicybinding
kubectl apply --dry-run=server -f deploy.yaml          # runs admission without persisting
kubectl -n kube-system get pods | grep -i -E "policy|webhook|kyverno|gatekeeper"`},
{note:'Choose the lightest tool that does the job: built-in PSA first, then ValidatingAdmissionPolicy, then a policy engine for what CEL cannot express. Every webhook you add is another component in the request path.'}],
src:[['Validating Admission Policy',R+'access-authn-authz/validating-admission-policy/'],['Admission Controllers',R+'access-authn-authz/admission-controllers/'],['Dynamic Admission Control',R+'access-authn-authz/extensible-admission-controllers/']]};

/* ---------- 4: Image security ---------- */
L['k8s:9:4']={blocks:[
{p:'Your cluster will run whatever images you tell it to. An image is code with the privileges you give it, so **where the image came from, whether it can be changed under you, and what is inside it** are security questions, not just packaging details. This lecture covers the controls you can apply without any special tooling, and where the extra tools fit.'},
{h:'1. Private registries and pull secrets'},
{p:'A private registry requires credentials. The kubelet pulls images on behalf of the Pod, so the credentials must be attached to the Pod (or its ServiceAccount) as an **imagePullSecret**, in the **same namespace**.'},
{code:`kubectl create secret docker-registry regcred -n shop \\
  --docker-server=registry.example.com --docker-username=ci --docker-password="$REG_TOKEN" --docker-email=ci@example.com

# per Pod
spec:
  imagePullSecrets: [{name: regcred}]
# or once for every Pod that uses a ServiceAccount
kubectl patch serviceaccount default -n shop -p '{"imagePullSecrets":[{"name":"regcred"}]}'

$ kubectl get secret regcred -n shop -o jsonpath='{.type}{"\\n"}'
kubernetes.io/dockerconfigjson
$ kubectl describe pod web | grep -A3 "Failed to pull"
  Failed to pull image "registry.example.com/web:1.4": ... pull access denied, repository does not exist or may require authorization`},
{ul:['The pull secret is **namespaced**: a Secret in `default` does nothing for a Pod in `shop`.','On clouds prefer **identity-based pulls** (node IAM roles, workload identity) over static passwords.','Use a **read-only** registry credential, never a push credential.']},
{h:'2. Tags are mutable, digests are not'},
{t:[['Reference','Behaviour','Risk'],
['`nginx`, `nginx:latest`','Whatever the publisher pushed last','Unreproducible; different nodes may run different content'],
['`nginx:1.27.2`','A version tag; usually stable but **the publisher can re-point it**','Supply chain surprise'],
['`nginx@sha256:3f1c...`','**Immutable**: the exact bytes','None: also what you scan and sign']]},
{code:`$ kubectl get pod web -o jsonpath='{.status.containerStatuses[0].imageID}{"\\n"}'
registry.example.com/web@sha256:3f1c9a...                  # the digest actually running
imagePullPolicy: IfNotPresent                              # default for tagged images; Always for :latest`},
{h:'3. Reduce what is inside'},
{ul:['Use **minimal base images** (distroless, scratch, slim): no shell or package manager means fewer tools for an attacker.','**Multi-stage builds** keep compilers and test tools out of the final image.','Run as a **non-root numeric user** (`USER 10001`).','**Scan** images in CI and in the registry for known vulnerabilities (Trivy, Grype) and **rebuild regularly**, because a clean image today has CVEs next month.','Never bake **secrets** into layers: anyone who can pull the image can read them.']},
{h:'4. Control what may run'},
{t:[['Control','What it enforces'],
['Admission policy on image registry','Only `registry.example.com/*` images allowed'],
['Signature verification (Cosign, with Kyverno or similar)','Only images signed by your pipeline'],
['`AlwaysPullImages` admission plugin','Credentials are checked on every pull (see below)'],
['Digest pinning in manifests','Exactly the scanned bytes run']]},
{code:`# ValidatingAdmissionPolicy expression: all containers must come from our registry
validations:
- expression: "object.spec.template.spec.containers.all(c, c.image.startsWith('registry.example.com/'))"
  message: "Images must come from registry.example.com"`},
{p:'**Why AlwaysPullImages matters in shared clusters:** without it, a Pod that does **not** present credentials can still use an image that another tenant already pulled to the node (`imagePullPolicy: IfNotPresent`), bypassing the pull secret check.'},
{h:'Diagnosing image problems'},
{t:[['Symptom','Cause','Check'],
['`ErrImagePull`, `unauthorized`','Missing or wrong pull secret, wrong namespace','`kubectl get secret regcred -n <ns>`'],
['`manifest unknown`','Tag or name does not exist','Registry UI, `crictl pull` on a node'],
['Works on one node, fails on another','Image cached on one node only; credentials missing','Pull policy and pull secrets'],
['Different behaviour per node','`latest` or a moved tag','Pin by digest'],
['`x509: certificate signed by unknown authority`','Registry uses a private CA','Add the CA to the runtime trust store']]},
{note:'The highest-value habits are cheap: pin versions or digests, scan in CI, run as non-root, pull only from your own registry, and rebuild often.'}],
src:[['Images',C+'containers/images/'],['Pull an Image from a Private Registry',T+'configure-pod-container/pull-image-private-registry/'],['Container Image Security',SEC+'#container']]};

/* ---------- 5: Audit and CIS ---------- */
L['k8s:9:5']={blocks:[
{p:'Two practices answer two different security questions. **Audit logging** tells you **what happened**: who did what, to which object, when, and with what result. **Benchmark scanning** (CIS with kube-bench) tells you **how well hardened** the cluster is against an agreed checklist. One is evidence after the fact, the other is a way to find weaknesses before an attacker does.'},
{h:'Audit logging: a recording of the API'},
{p:'The API server can write an **audit event** for each request at several **stages**. A **policy** decides what to record and how much detail, which matters because detailed audit logs are large and can contain sensitive data.'},
{t:[['Level','Records'],
['`None`','Nothing for matching requests'],
['`Metadata`','Who, what verb, which resource, when, response code. **No request or response bodies**'],
['`Request`','Metadata plus the request body'],
['`RequestResponse`','Metadata plus request and response bodies (large)']]},
{code:`# /etc/kubernetes/audit/policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
omitStages: ["RequestReceived"]
rules:
- level: None                                         # skip noisy health checks
  nonResourceURLs: ["/healthz*", "/livez*", "/readyz*"]
- level: None
  users: ["system:kube-proxy"]
  verbs: ["watch"]
- level: Metadata                                     # NEVER log the contents of Secrets or ConfigMaps
  resources: [{group: "", resources: ["secrets", "configmaps", "tokenreviews"]}]
- level: RequestResponse                              # full detail for access control changes
  resources: [{group: "rbac.authorization.k8s.io"}]
- level: Metadata                                     # everything else`},
{ul:['Rules are evaluated **in order**; the **first** match decides the level. Put specific rules before the catch-all.','Log Secrets at **Metadata** only: a body level would write secret values into the log.']},
{h:'Enabling it on kubeadm'},
{code:`# kube-apiserver static Pod manifest: flags
    - --audit-policy-file=/etc/kubernetes/audit/policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit/audit.log
    - --audit-log-maxage=30
    - --audit-log-maxbackup=10
    - --audit-log-maxsize=100
# plus hostPath volumes and volumeMounts for /etc/kubernetes/audit and /var/log/kubernetes/audit
# (a missing mount or typo stops the API server from starting: edit with a backup, check crictl logs)

$ sudo tail -n 1 /var/log/kubernetes/audit/audit.log | jq '{user:.user.username, verb:.verb, uri:.requestURI, code:.responseStatus.code}'
{"user":"kubernetes-admin","verb":"delete","uri":"/api/v1/namespaces/shop/pods/web-1","code":200}
$ sudo jq -r 'select(.verb=="delete" and .objectRef.resource=="secrets") | [.requestReceivedTimestamp,.user.username,.objectRef.name] | @tsv' /var/log/kubernetes/audit/audit.log`},
{ul:['Ship audit logs **off the node** to a central, tamper-resistant store; an attacker with node access can edit local files.','Managed services expose audit logs through their logging products (CloudWatch, Azure Monitor, Cloud Logging).','Useful questions audit logs answer: who deleted that Deployment, which service account listed Secrets, which IP made failed login attempts.']},
{h:'CIS Benchmark and kube-bench'},
{p:'The **CIS Kubernetes Benchmark** is a consensus checklist for hardening the control plane, etcd, kubelet and policies. **kube-bench** (Aqua Security) runs the checks on a node and reports each as PASS, FAIL, WARN or INFO with remediation text.'},
{code:`# on a control plane node (choose the benchmark version that matches your Kubernetes version)
$ kube-bench run --targets master,etcd,node,policies
[INFO] 1 Control Plane Security Configuration
[PASS] 1.1.1 Ensure that the API server pod specification file permissions are set to 600 or more restrictive
[FAIL] 1.2.2 Ensure that the --token-auth-file parameter is not set ...
[FAIL] 1.2.18 Ensure that the --profiling argument is set to false
== Summary master ==
42 checks PASS    11 checks FAIL    9 checks WARN    0 checks INFO

# or as a Job in the cluster
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job.yaml
kubectl logs job/kube-bench | grep -E "\\[FAIL\\]|== Summary"`},
{t:[['Typical finding','Where to fix'],
['API server flags (profiling, anonymous auth, audit, admission plugins)','Edit `/etc/kubernetes/manifests/kube-apiserver.yaml`'],
['Kubelet settings (anonymous auth, read-only port, rotate certificates)','`/var/lib/kubelet/config.yaml`, restart the kubelet'],
['File permissions and ownership of manifests, PKI, kubeconfig','`chmod 600`, `chown root:root`'],
['etcd settings (client cert auth, peer TLS)','`/etc/kubernetes/manifests/etcd.yaml`'],
['Policies (network policies exist, default ServiceAccount, Pod Security)','Cluster configuration and namespaces']]},
{h:'Reading results sensibly'},
{ul:['**FAIL** needs a fix or a recorded exception; **WARN** needs a manual check; some checks do not apply to managed services where the provider owns the control plane.','Fix in small batches and re-run: one wrong API server flag can stop the cluster.','Scan again **after upgrades**, because defaults and file locations change.','Treat the scan as a starting point, not a certificate: it cannot see your applications or your RBAC design.']},
{note:'Exam tip: for audit logging tasks you are given a policy to write or apply; the work is in the API server manifest (flags plus hostPath volume mounts). After editing, wait for the API server with `crictl ps`, then confirm the log file receives events.'}],
src:[['Auditing',C+'cluster-administration/audit/'],['Securing a Cluster',T+'administer-cluster/securing-a-cluster/'],['kube-bench','https://github.com/aquasecurity/kube-bench'],['CIS Kubernetes Benchmark','https://www.cisecurity.org/benchmark/kubernetes']]};

/* ---------- Additional content ---------- */
/* 6: Mutating admission policies */
L['k8s:9:6']={blocks:[
{p:'Section 10 showed **ValidatingAdmissionPolicy** (accept or reject). **MutatingAdmissionPolicy** is its counterpart: it **changes** objects as they are admitted, using CEL, with no webhook service to run.'},
{h:'Why it matters'},
{ul:['Typical mutations (defaults, labels, security settings, sidecar injection) used to need a **mutating webhook** that you had to deploy, secure and keep available.','A declarative policy runs **inside the API server**: no network hop, no extra failure mode, versioned as ordinary YAML.','Version note: the course tracks this feature as stable from Kubernetes v1.36. On older clusters it is beta or alpha and may need a feature gate and a different API version; check `kubectl api-resources | grep mutatingadmissionpolicy`.']},
{h:'Example: default a security setting'},
{code:`apiVersion: admissionregistration.k8s.io/v1
kind: MutatingAdmissionPolicy
metadata: {name: default-no-priv-escalation}
spec:
  matchConstraints:
    resourceRules:
    - apiGroups: [""]
      apiVersions: ["v1"]
      operations: ["CREATE"]
      resources: ["pods"]
  failurePolicy: Fail
  reinvocationPolicy: IfNeeded
  mutations:
  - patchType: ApplyConfiguration
    applyConfiguration:
      expression: >
        Object{
          spec: Object.spec{
            containers: object.spec.containers.map(c, Object.spec.containers{
              name: c.name,
              securityContext: Object.spec.containers.securityContext{
                allowPrivilegeEscalation: false
              }
            })
          }
        }
---
apiVersion: admissionregistration.k8s.io/v1
kind: MutatingAdmissionPolicyBinding
metadata: {name: default-no-priv-escalation-binding}
spec:
  policyName: default-no-priv-escalation
  matchResources:
    namespaceSelector: {matchLabels: {environment: prod}}`},
{h:'Mutation types'},
{t:[['patchType','How it works'],
['`ApplyConfiguration`','CEL builds a partial object that is merged like a server-side apply (readable, good for adding fields)'],
['`JSONPatch`','CEL builds an RFC 6902 list of operations (precise add, replace, remove)']]},
{h:'Design notes'},
{ul:['Mutations run **before** validation, so pair a mutating policy with a validating one that checks the final result.','`reinvocationPolicy: IfNeeded` re-runs mutations if later plugins change the object.','Use the **binding** to scope by namespace or labels and to keep changes out of system namespaces.','Be cautious: mutated defaults surprise users. Document them and keep them minimal.','When logic needs external calls or data, you still need a webhook or a policy engine.']},
{note:'Test mutations with `kubectl apply --dry-run=server -o yaml` and inspect the returned object to see exactly what the policy changed.'}],
src:[['Mutating Admission Policy',K.R+'access-authn-authz/mutating-admission-policy/'],['Validating Admission Policy',K.R+'access-authn-authz/validating-admission-policy/'],['Admission Controllers',K.R+'access-authn-authz/admission-controllers/']]};

/* 7: Kyverno and Gatekeeper */
L['k8s:9:7']={blocks:[
{p:'Built-in admission policies cover simple rules. **Policy engines** add richer validation, mutation, generation, reporting and exceptions, with policy written as Kubernetes resources.'},
{t:[['','Kyverno','OPA Gatekeeper'],
['Policy language','YAML with patterns, JMESPath and CEL; no new language to learn','Rego (a logic language) in `ConstraintTemplate` objects'],
['Validate','Yes','Yes (core strength)'],
['Mutate','Yes, built in','Yes (Assign and AssignMetadata, more limited)'],
['Generate resources','Yes (for example a NetworkPolicy per new namespace)','No'],
['Image verification','Yes (Cosign and Notary signatures, attestations)','Via external data or other tools'],
['Reports and audit','Policy reports for existing resources','Audit of existing resources against constraints'],
['Learning curve','Lower for Kubernetes admins','Higher: Rego, but very expressive and reusable']]},
{h:'Kyverno example'},
{code:`apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: {name: require-requests-limits}
spec:
  validationFailureAction: Enforce          # or Audit
  background: true
  rules:
  - name: check-resources
    match:
      any:
      - resources: {kinds: [Pod]}
    exclude:
      any:
      - resources: {namespaces: [kube-system]}
    validate:
      message: "CPU and memory requests and a memory limit are required."
      pattern:
        spec:
          containers:
          - resources:
              requests: {cpu: "?*", memory: "?*"}
              limits:   {memory: "?*"}`},
{h:'Gatekeeper example'},
{code:`apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata: {name: k8srequiredlabels}
spec:
  crd:
    spec:
      names: {kind: K8sRequiredLabels}
      validation:
        openAPIV3Schema:
          type: object
          properties: {labels: {type: array, items: {type: string}}}
  targets:
  - target: admission.k8s.gatekeeper.sh
    rego: |
      package k8srequiredlabels
      violation[{"msg": msg}] {
        missing := {l | l := input.parameters.labels[_]} - {l | input.review.object.metadata.labels[l]}
        count(missing) > 0
        msg := sprintf("missing labels: %v", [missing])
      }
---
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata: {name: ns-must-have-team}
spec:
  match: {kinds: [{apiGroups: [""], kinds: [Namespace]}]}
  parameters: {labels: ["team"]}`},
{h:'Running policy engines safely'},
{ul:['Install in a **dedicated namespace**, exclude it and `kube-system` from policies, and set sensible `failurePolicy` (an unavailable fail-closed webhook can block the cluster).','Start in **Audit** mode, read the reports, fix or add exceptions, then switch to Enforce.','Run multiple replicas and set resource requests; the engine is now in the request path.','Keep policies in **Git** and test them in CI against sample manifests (`kyverno test`, `gator test`).','Prefer the **built-in** ValidatingAdmissionPolicy where it is enough; use an engine for mutation, generation, reporting or complex logic.']},
{code:`kubectl get clusterpolicy
kubectl get policyreport -A
kubectl get constrainttemplates,constraints
kubectl describe k8srequiredlabels ns-must-have-team       # shows violations found by audit`},
{note:'A policy that blocks deployments on day one creates resistance. Roll out in audit mode with clear messages, and give teams a documented exception process.'}],
src:[['Kyverno','https://kyverno.io/docs/'],['OPA Gatekeeper','https://open-policy-agent.github.io/gatekeeper/website/docs/'],['Admission Controllers',K.R+'access-authn-authz/admission-controllers/']]};

/* 8: User namespaces */
L['k8s:9:8']={blocks:[
{p:'Normally root (UID 0) in a container is root on the node as far as the kernel is concerned, only restricted by capabilities and namespaces. **User namespaces** map UIDs inside the container to **unprivileged UIDs on the host**, so a container escape lands as a harmless user.'},
{svg:K.dg(700,180,[
[10,50,300,90,'Without user namespaces|container UID 0 (root)|= host UID 0 (root)',0],[390,50,300,90,'With user namespaces|container UID 0 (root)|= host UID 65536+ (unprivileged)',2]],[[310,95,390,95]])},
{h:'Enabling it for a Pod'},
{code:`apiVersion: v1
kind: Pod
metadata: {name: isolated}
spec:
  hostUsers: false                      # use a user namespace for this Pod
  containers:
  - name: app
    image: myapp:2.1
    securityContext:
      runAsUser: 0                      # root inside: unprivileged outside`},
{ul:['`hostUsers: false` asks the kubelet and runtime to create a **user namespace** for the Pod. Each Pod gets its own range of host UIDs, so Pods are isolated from each other as well.','Version note: the course tracks this feature as stable from Kubernetes v1.36 (it has been advancing through beta). Confirm in the release notes of your version.','Requirements: a **Linux kernel** with idmapped mount support for the volume types you use, a runtime that supports it (recent containerd or CRI-O with an OCI runtime that supports it), and the node configured with a UID range for the kubelet.']},
{h:'What it helps with'},
{t:[['Risk','Benefit'],
['Container escape through a kernel or runtime bug','The attacker is an unprivileged host user, not root'],
['Capabilities inside the container (for example `CAP_SYS_ADMIN`)','Apply only within the Pod user namespace, not to the host'],
['Several Pods running as the same UID','Each Pod maps to a different host range, so they cannot touch each other files']]},
{h:'Limits'},
{ul:['Not a substitute for dropping capabilities, seccomp and read-only filesystems: combine them.','Some features are incompatible: `hostNetwork`, `hostPID`, `hostIPC` and host-path volumes cannot be used with `hostUsers: false`.','Volume ownership and `fsGroup` interact with idmapping; test storage drivers.','Pod Security Admission **restricted** may accept more privileged settings when user namespaces are on; check the profile details for your version.']},
{code:`kubectl exec isolated -- id                          # uid=0(root)
kubectl exec isolated -- cat /proc/self/uid_map      # 0  65536  65536   (container UID 0 maps to a high host UID)
kubectl get pod isolated -o jsonpath='{.spec.hostUsers}{"\\n"}'`},
{note:'Treat user namespaces as an added layer for workloads that must run as root inside the container, such as build tools and some legacy images.'}],
src:[['User Namespaces',K.C+'workloads/pods/user-namespaces/'],['Use a User Namespace With a Pod',K.T+'configure-pod-container/user-namespaces/']]};

/* 9: RuntimeClass */
L['k8s:9:9']={blocks:[
{p:'Containers share the host kernel, so a kernel bug can be an escape route. For **untrusted or multi-tenant workloads** you can run Pods under a **sandboxed runtime** that adds a stronger isolation boundary, selected per Pod with a **RuntimeClass**.'},
{h:'Sandboxed runtimes'},
{t:[['Runtime','Idea','Trade-offs'],
['**gVisor** (runsc)','A user-space kernel intercepts system calls so the app talks to gVisor, not the host kernel','Some syscalls and performance paths are slower or unsupported'],
['**Kata Containers**','Each Pod runs in a lightweight **VM** with its own kernel','Strong isolation; higher startup time and memory overhead, needs virtualization support'],
['**Firecracker-based**, others','MicroVMs, used by some cloud platforms','Provider-specific']]},
{h:'RuntimeClass'},
{code:`apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata: {name: gvisor}
handler: runsc                      # name of the runtime handler configured in containerd or CRI-O
scheduling:
  nodeSelector: {sandbox: gvisor}   # run only on nodes that have it installed
  tolerations:
  - {key: sandbox, operator: Equal, value: gvisor, effect: NoSchedule}
overhead:
  podFixed: {cpu: 100m, memory: 120Mi}   # extra cost counted by the scheduler
---
apiVersion: v1
kind: Pod
metadata: {name: untrusted}
spec:
  runtimeClassName: gvisor
  containers:
  - name: app
    image: customer/code:1.0`},
{code:`# containerd: register the handler on the node (config.toml excerpt)
#   [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc]
#     runtime_type = "io.containerd.runsc.v1"
sudo systemctl restart containerd

kubectl get runtimeclass
kubectl describe pod untrusted | grep -i "runtime class"
kubectl get pod untrusted -o wide`},
{ul:['The **handler** must exist in the runtime configuration on every node the class can run on; otherwise the Pod fails with `RuntimeHandlerNotFound`-style errors.','`scheduling` puts sandboxed Pods only on prepared nodes; `overhead` accounts for the extra resources of the sandbox.','Combine with **admission policy** so untrusted namespaces must use the sandbox class.','Managed offerings exist (for example GKE Sandbox, and Kata or confidential-computing node pools on other clouds).']},
{h:'When to use it'},
{ul:['Running **customer-provided code** or CI jobs.','**Multi-tenant** platforms where tenants share nodes.','Workloads handling untrusted input where defence in depth matters.','Not needed for ordinary trusted applications: first apply Pod Security, seccomp, non-root and network policy.']},
{note:'Test your applications under the sandbox: unusual syscalls, file system features and performance-sensitive I/O can behave differently.'}],
src:[['Runtime Class',K.C+'containers/runtime-class/'],['gVisor','https://gvisor.dev/docs/'],['Kata Containers','https://github.com/kata-containers/kata-containers']]};

/* 10: KMS */
L['k8s:9:10']={blocks:[
{p:'Local-key encryption at rest (`aescbc`, `secretbox`) keeps the key in a file on the control plane. A **KMS provider** moves the key to an **external key management service** (cloud KMS, HSM, Vault) and uses **envelope encryption**.'},
{h:'Envelope encryption'},
{flow:['The API server generates a data encryption key (DEK) and encrypts the Secret with it','It asks the KMS plugin to encrypt (wrap) the DEK with a key encryption key (KEK) that never leaves the KMS','The ciphertext and the wrapped DEK are stored in etcd','On read, the KMS plugin unwraps the DEK and the API server decrypts the Secret']},
{ul:['Only a small DEK goes to the KMS, so latency and cost stay low.','The **KEK stays in the KMS** (or HSM): a stolen etcd backup plus the control plane disk is not enough to decrypt data.','**KMS v2** (the current design) caches DEKs, supports key rotation without rewriting everything at once and reports health.']},
{h:'Configuration'},
{code:`apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
- resources: ["secrets"]
  providers:
  - kms:
      apiVersion: v2
      name: cloud-kms
      endpoint: unix:///var/run/kmsplugin/socket.sock     # the plugin runs on the control plane node
      timeout: 3s
  - identity: {}                                          # readable fallback for old data during migration`},
{ul:['The **KMS plugin** is a gRPC service (a static Pod or systemd service on every control plane node) that talks to the KMS.','If the plugin or the KMS is unreachable, **reads and writes of encrypted resources fail**: plan availability, caching and alerting for it.','Managed services expose this as a setting: "envelope encryption with a customer-managed key" on EKS, AKS and GKE.']},
{h:'Key rotation'},
{flow:['Create a new key version in the KMS (or rotate the KEK)','KMS v2 detects the new key ID and starts using it for new writes','Rewrite existing Secrets so they are re-wrapped: kubectl get secrets -A -o json | kubectl replace -f -','Retire the old key version after verification and backups']},
{code:`kubectl get secrets -A -o json | kubectl replace -f -
# Check that new objects are stored encrypted with the KMS provider (etcd value begins with k8s:enc:kms:v2:)
sudo ETCDCTL_API=3 etcdctl ... get /registry/secrets/default/enc-test | hexdump -C | head
kubectl get --raw /livez/kms-providers`},
{h:'Choosing'},
{t:[['Option','Use when'],
['`aescbc` / `secretbox` with a local key','Labs, small clusters, protection against disk and backup theft only'],
['KMS v2 with a cloud KMS or HSM','Production, compliance, key custody outside the cluster, audit of key use'],
['External secret manager instead of Kubernetes Secrets','You want secrets to live outside etcd completely (External Secrets, CSI secrets store)']]},
{note:'Back up the **KMS key access** (and policies), not just etcd: losing access to the KEK makes every encrypted Secret unreadable.'}],
src:[['Using a KMS provider for data encryption',K.T+'administer-cluster/kms-provider/'],['Encrypting Confidential Data at Rest',K.T+'administer-cluster/encrypt-data/'],['Good practices for Kubernetes Secrets',K.C+'security/secrets-good-practices/']]};

/* 11: Supply chain and Falco */
L['k8s:9:11']={blocks:[
{p:'Attacks increasingly arrive through **what you run** (images, dependencies, build systems) rather than through the cluster API. Supply chain security proves where software came from; runtime detection notices when something behaves wrongly after it starts.'},
{h:'Supply chain controls'},
{t:[['Control','What it gives you','Tools'],
['**Image scanning**','Known vulnerabilities in OS packages and libraries, in CI and in the registry','Trivy, Grype, registry scanners'],
['**SBOM** (software bill of materials)','A list of components inside an image, to search when a new CVE appears','Syft, Trivy, build tool integrations (SPDX, CycloneDX)'],
['**Image signing**','Proof an image was built by your pipeline and not altered','Cosign (Sigstore), Notary'],
['**Attestations and provenance**','Signed statements about how and where an image was built (SLSA)','in-toto, SLSA generators'],
['**Admission verification**','The cluster refuses unsigned or unscanned images','Kyverno verifyImages, policy-controller, Ratify with Gatekeeper'],
['**Pinned digests and trusted registries**','Reproducible deployments from known sources','Admission policy, `@sha256` references']]},
{code:`# Sign and verify with Cosign
cosign sign --key cosign.key registry.example.com/shop/web@sha256:3f1c...
cosign verify --key cosign.pub registry.example.com/shop/web@sha256:3f1c...

# SBOM and scan
syft registry.example.com/shop/web:1.4.2 -o spdx-json > sbom.json
trivy image --severity HIGH,CRITICAL registry.example.com/shop/web:1.4.2`},
{code:`# Kyverno: require a valid signature
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: {name: verify-signature}
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-signature
    match: {any: [{resources: {kinds: [Pod]}}]}
    verifyImages:
    - imageReferences: ["registry.example.com/shop/*"]
      attestors:
      - entries:
        - keys: {publicKeys: "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"}`},
{h:'Runtime detection with Falco'},
{p:'**Falco** watches system calls (using eBPF or a kernel module) and Kubernetes audit events, and raises an alert when behaviour matches a **rule**: a shell started in a container, a sensitive file read, an unexpected outbound connection.'},
{code:`helm repo add falcosecurity https://falcosecurity.github.io/charts
helm install falco falcosecurity/falco -n falco --create-namespace --set tty=true
kubectl -n falco logs -l app.kubernetes.io/name=falco -f
# Example alert:
# Warning A shell was spawned in a container with an attached terminal (user=root pod=web-7d9f container=app shell=sh ...)`},
{code:`- rule: Unexpected outbound connection from db
  desc: The database Pods should not connect to the internet
  condition: >
    evt.type=connect and container and k8s.pod.label.app = "db" and not fd.sip in (10.0.0.0/8)
  output: "db connecting out (pod=%k8s.pod.name dest=%fd.rip:%fd.rport)"
  priority: WARNING`},
{ul:['Send alerts to a SIEM or chat through **Falcosidekick**, and tune rules to cut noise.','Detection is not prevention: combine with Pod Security, network policy and, where useful, enforcement tools (seccomp profiles, KubeArmor, Tetragon).','Runtime tools need privileged access to nodes: keep them updated and treat them as part of the trusted base.']},
{h:'Putting it together'},
{flow:['Build from minimal base images in CI','Scan, generate an SBOM and sign the image','Push to a controlled registry; pin by digest','Admission policy verifies signature and scan results','Runtime detection watches for unexpected behaviour','Rebuild and redeploy quickly when a CVE is announced']},
{note:'Start small: scanning in CI and pinned digests give the best return. Add signing and admission verification when you have a stable build pipeline to sign from.'}],
src:[['Sigstore Cosign','https://docs.sigstore.dev/'],['Falco','https://falco.org/docs/'],['SLSA','https://slsa.dev/'],['Securing a Cluster',K.T+'administer-cluster/securing-a-cluster/']]};
})();
