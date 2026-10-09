/* LearnSphere - Docker, Section 09: Security.
   Lectures 0-8 are core, 9-14 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;
const SEC=E+'security/';

/* ---------- diagrams ---------- */
const layers=K.dg(700,300,[
[10,10,680,280,'Defence in depth: each layer reduces what an attacker can do',1],
[40,45,300,36,'1. Your application (non-root, minimal image)',2],
[40,89,300,36,'2. Namespaces + cgroups (isolation, limits)',0],
[40,133,300,36,'3. Capabilities + seccomp (fewer powers)',0],
[40,177,300,36,'4. AppArmor / SELinux (mandatory access control)',0],
[40,221,300,36,'5. Shared host kernel (one bug affects all)',0],
[390,45,280,50,'Image supply chain|scan, sign, minimal bases',0],[390,110,280,50,'Secrets|files and vaults, not env vars',0],[390,175,280,50,'Daemon + socket|root-equivalent, protect it',2]],[]);

const sock=K.dg(700,180,[
[10,60,150,56,'Any process that|can write to the socket',0],[230,60,170,56,'/var/run/docker.sock|Docker API',2],[470,50,220,76,'dockerd (root)|can start privileged containers|and mount the host disk',0]],
[[160,88,230,88],[400,88,470,88]]);

/* ---------- 0: security model ---------- */
L['docker:8:0']={blocks:[
{p:'Containers are **isolated processes**, not separate computers. Docker adds several Linux security features around each container, but the container still shares the **host kernel**. Good security means using every layer and not trusting a single one.'},
{svg:layers},
{h:'What each layer does'},
{t:[['Layer','Protects against','How'],
['**Namespaces**','Seeing other processes, networks, mounts','A private view of PIDs, network, mounts, hostname, users'],
['**cgroups**','One container starving the host (DoS)','CPU, memory, PID and I/O limits'],
['**Capabilities**','Using root powers the app does not need','Root is split into about 40 small privileges; Docker keeps a small default set'],
['**seccomp**','Dangerous system calls','A filter that blocks dozens of syscalls by default'],
['**AppArmor / SELinux**','Access to files and resources outside policy','Mandatory access control profiles'],
['**User namespaces / non-root**','Root in the container being root on the host','Maps or avoids root']]},
{h:'What containers do NOT protect against'},
{ul:['**A kernel vulnerability:** all containers share the host kernel; an exploit can break out of every container at once.','**A privileged container** (`--privileged`): it gets nearly full host access.','**Mounting dangerous host paths** or the Docker socket.','**Vulnerable software in the image:** the container runs whatever you packed.','**Leaked secrets** in images, environment variables or logs.']},
{h:'The daemon is the biggest target'},
{p:'`dockerd` runs as **root**. Anyone who can talk to it can start a container that mounts the host file system. Controlling access to the daemon equals controlling the host.'},
{h:'Threat to control table'},
{t:[['Threat','Control'],
['Compromised application runs as root','Non-root `USER`, drop capabilities'],
['Exploit via a vulnerable library','Scan images, use minimal bases, rebuild often'],
['Malicious or tampered image','Trusted sources, pin digests, verify signatures'],
['Stolen secret','Secret files and vaults, short-lived tokens'],
['Container escape via the daemon','Protect the socket, rootless mode, never mount docker.sock'],
['Resource exhaustion','Memory, CPU and PID limits'],
['Lateral movement','Separate networks, only publish what is needed'],
['Persistence on the container filesystem','Read-only root file system']]},
{h:'A practical baseline for every container'},
{flow:['Use a small, trusted, pinned base image and scan it','Run as a non-root user','Drop all capabilities, add back only what is needed','Add no-new-privileges and keep the default seccomp profile','Make the root filesystem read-only; use tmpfs or volumes for writes','Set memory, CPU and PID limits','Keep secrets out of the image and environment','Publish only the ports that must be public']},
{code:`docker run -d --name hardened \\
  --user 10001:10001 \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  --read-only --tmpfs /tmp \\
  --memory 256m --cpus 0.5 --pids-limit 100 \\
  myapp:1.0`},
{note:'Security is a process, not a feature: update base images, rescan regularly, and review what is running with `docker ps` and `docker inspect`.'}],
src:[['Docker security',SEC],['Linux kernel capabilities',SEC+'#kernel-capabilities'],['Security best practices',K.D+'build/building/best-practices/']]};

/* ---------- 1: non-root ---------- */
L['docker:8:1']={blocks:[
{p:'By default a container process runs as **root** (user ID 0). If an attacker takes over the application, they are root inside the container, can change anything there, and have a much easier time attacking the host. Running as an **unprivileged user** is one of the most effective, cheapest hardening steps.'},
{h:'Check who you are'},
{code:`docker run --rm alpine id            # uid=0(root) gid=0(root)
docker exec web id                   # who is a running container using?
docker inspect -f '{{.Config.User}}' web   # empty means root`},
{h:'Option 1: USER in the Dockerfile (best)'},
{code:`FROM python:3.12-slim
RUN groupadd -r app --gid 10001 && useradd -r -g app --uid 10001 -m app
WORKDIR /app
COPY --chown=app:app . .
RUN pip install --no-cache-dir -r requirements.txt      # install as root first if needed
USER 10001:10001
CMD ["python", "app.py"]`},
{ul:['Create the user **before** `USER`, and do package installs while still root.','Use **numeric IDs** (`10001`): Kubernetes and security tools can verify them.','`COPY --chown` gives the app user ownership of its files.','Many images already include a non-root user (`node`, `nginx` unprivileged variants, `nobody`).']},
{h:'Option 2: --user at run time'},
{code:`docker run --rm --user 1000:1000 alpine id
docker run -d --user "$(id -u):$(id -g)" -v "$PWD":/data myapp     # files in a bind mount belong to YOU on the host`},
{h:'Typical problems and fixes'},
{t:[['Symptom','Cause','Fix'],
['`Permission denied` writing a folder','The directory is owned by root','`COPY --chown`, or `RUN chown` while still root'],
['Cannot bind port 80','Ports below 1024 need a privilege','Listen on 8080 and publish `-p 80:8080`, or add `--cap-add NET_BIND_SERVICE`'],
['`Permission denied` on a volume','Volume created root-owned','Set ownership in the image before declaring the volume, or init with a one-off root container'],
['Bind mount files owned by root on host','Container ran as root','Run with `--user $(id -u):$(id -g)`'],
['App needs to write to its own directory','Read-only or root-owned','Create a writable data directory for the app user']]},
{h:'Port 80 as non-root'},
{code:`# Dockerfile: listen on an unprivileged port
EXPOSE 8080
USER 10001
# run: docker run -p 80:8080 myapp        (the HOST side uses 80, the container side uses 8080)`},
{h:'Rootless containers vs non-root users'},
{t:[['','Non-root user in the container','Rootless Docker'],
['What runs as non-root','The **application** process','The **Docker daemon** and containers'],
['Protects','The container from its own app','The host from a daemon or container escape'],
['Effort','Small (Dockerfile change)','Larger (different install; Additional content)']]},
{note:'Using both is best: a non-root user inside the image and, where possible, rootless or user-namespace remapping on the host.'},
{h:'Verify'},
{code:`docker run -d --name t myapp
docker exec t id                          # uid=10001
docker exec t sh -c "touch /etc/test" 2>&1 | head -1    # Permission denied  (good)
docker rm -f t`}],
src:[['USER instruction',K.D+'reference/dockerfile/#user'],['Rootless mode',E+'security/rootless/']]};

/* ---------- 2: capabilities, seccomp, AppArmor, SELinux ---------- */
L['docker:8:2']={blocks:[
{p:'Even as root, a container is meant to be **weak**. Docker removes most root powers and filters system calls. You can tighten these further, or accidentally destroy them with `--privileged`.'},
{h:'Linux capabilities'},
{p:'Traditional root can do everything. **Capabilities** split root into small privileges, for example `NET_BIND_SERVICE` (bind ports below 1024), `CHOWN` (change file owner), `NET_RAW` (raw sockets, ping), `SYS_ADMIN` (a huge catch-all, very dangerous).'},
{t:[['Flag','Effect'],
['(default)','Docker gives a small default set (CHOWN, NET_BIND_SERVICE, SETUID, SETGID, KILL, ...)'],
['`--cap-drop ALL`','Remove every capability'],
['`--cap-add NET_BIND_SERVICE`','Grant one back'],
['`--cap-drop NET_RAW`','Remove one (blocks ping and packet crafting)'],
['`--security-opt no-new-privileges`','Child processes can never gain more privileges (blocks setuid tricks)'],
['`--privileged`','**All** capabilities, all devices, no seccomp/AppArmor limits']]},
{code:`# Drop everything, then add only what the service needs
docker run -d --name web \\
  --cap-drop ALL --cap-add NET_BIND_SERVICE \\
  --security-opt no-new-privileges \\
  -p 80:80 nginx

# See the effect
docker run --rm --cap-drop ALL alpine chown nobody /tmp    # chown: Operation not permitted
docker run --rm --cap-drop NET_RAW alpine ping -c1 8.8.8.8   # ping: permission denied (raw socket)
docker run --rm alpine sh -c "apk add -q libcap && capsh --print | head -3"
docker inspect -f '{{.HostConfig.CapAdd}} {{.HostConfig.CapDrop}}' web`},
{h:'seccomp: filtering system calls'},
{p:'**seccomp** blocks system calls a normal application never needs. Docker applies a **default profile** that blocks dozens of risky calls (such as loading kernel modules or rebooting) while allowing ordinary ones.'},
{code:`# Default profile is active automatically. Check:
docker run --rm alpine grep Seccomp /proc/self/status       # Seccomp: 2  (filter mode)

# Custom profile
docker run --rm --security-opt seccomp=./profile.json alpine ls

# NEVER in production: disables seccomp
docker run --rm --security-opt seccomp=unconfined alpine ls`},
{h:'AppArmor and SELinux: mandatory access control'},
{t:[['','AppArmor','SELinux'],
['Used on','Ubuntu, Debian, SUSE','RHEL, Fedora, CentOS'],
['Docker default','`docker-default` profile applied automatically','Container processes run in a confined type (`container_t`)'],
['Custom','`--security-opt apparmor=my-profile`','`--security-opt label=type:my_type_t`'],
['Disable (avoid)','`apparmor=unconfined`','`label=disable`']]},
{code:`aa-status | grep docker                       # AppArmor profiles loaded (Ubuntu)
docker run --rm --security-opt apparmor=unconfined alpine true    # removes the profile: avoid
docker run --rm -v "$PWD":/data:Z alpine ls /data                  # SELinux: relabel the bind mount`},
{p:'Version note: Engine 29.8.0 added daemon support for customising the **default AppArmor profile template**, which helps when the standard profile needs a small organisation-wide change. Check the release notes for details.'},
{h:'The danger of --privileged'},
{code:`docker run --rm --privileged alpine sh -c "ls /dev | head -3; mount | head -3"
# The container sees host devices and can mount disks: it is almost the same as being root on the host.`},
{ul:['Do **not** use `--privileged` unless you truly need it (rare tools such as some CI runners).','Prefer the narrow alternative: `--cap-add SYS_PTRACE` for a debugger, `--device /dev/ttyUSB0` for one device.','`--cap-add SYS_ADMIN` is almost as dangerous as privileged.']},
{h:'A minimal tight profile'},
{flow:['--cap-drop ALL','--cap-add only the one or two you need','--security-opt no-new-privileges','Keep the default seccomp and AppArmor/SELinux (do not set unconfined)','--read-only and non-root user']}],
src:[['Runtime privilege and capabilities',R+'cli/docker/container/run/#runtime-privilege-and-linux-capabilities'],['seccomp profiles',SEC+'seccomp/'],['AppArmor',SEC+'apparmor/']]};

/* ---------- 3: protecting the daemon socket ---------- */
L['docker:8:3']={blocks:[
{p:'The Docker daemon listens on a **Unix socket**, `/var/run/docker.sock`. Whoever can send requests to it controls Docker, and Docker runs as root. That means **access to the socket is equivalent to root on the host.**'},
{svg:sock},
{h:'Why it is so powerful'},
{code:`# A user in the docker group can do this and get a root shell on the HOST file system:
docker run --rm -it -v /:/host alpine chroot /host sh
# No password, no sudo: the daemon starts the container as root for them.`},
{h:'Rule 1: never mount the socket into a container'},
{code:`# DANGEROUS
docker run -v /var/run/docker.sock:/var/run/docker.sock some-tool`},
{p:'A compromised container with the socket can create a privileged container and take over the host. Tools that insist on the socket (CI runners, dashboards, reverse proxies with auto-discovery) should be treated as **fully trusted** and ideally used through a **socket proxy** that allows only read-only API calls.'},
{h:'Rule 2: control who is in the docker group'},
{ul:['Membership in `docker` is root-equivalent. Add only administrators.','On shared servers consider **rootless Docker** (Additional content) or **sudo** with auditing.','The socket file mode is `660 root:docker`; do not make it world-writable.']},
{h:'Remote access: do it securely'},
{t:[['Method','Security','Notes'],
['**SSH** (`ssh://user@host`)','Good','Simplest; uses SSH keys and SSH logging (Section 2)'],
['**TCP with mutual TLS**, port 2376','Good if certificates are managed','Both server and client present certificates (`--tlsverify`)'],
['**TCP without TLS**, port 2375','**Never**','Anyone who can reach the port is root on the host']]},
{code:`# What a mutual TLS daemon configuration looks like (daemon.json)
{
  "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2376"],
  "tlsverify": true,
  "tlscacert": "/etc/docker/certs/ca.pem",
  "tlscert":   "/etc/docker/certs/server-cert.pem",
  "tlskey":    "/etc/docker/certs/server-key.pem"
}

# Client
docker --tlsverify --tlscacert=ca.pem --tlscert=cert.pem --tlskey=key.pem -H tcp://host:2376 info`},
{note:'On systemd systems the unit already passes `-H fd://`. Defining `hosts` in daemon.json as well causes the error "directives are specified both as a flag and in the configuration file". Use a systemd override to remove the flag.'},
{h:'Checks you can do today'},
{code:`ls -l /var/run/docker.sock                     # srw-rw---- root docker
getent group docker                             # who is in the group?
ss -tlnp | grep -E "2375|2376"                  # is the daemon listening on TCP?
docker ps -q | xargs docker inspect -f '{{.Name}} {{range .Mounts}}{{.Source}} {{end}}' | grep docker.sock`},
{h:'Safer alternatives'},
{ul:['**Rootless mode:** a compromised daemon is only a normal user.','**Socket proxy** (a small container exposing a filtered subset of the API) for tools that need to read container lists.','**CI:** use dedicated runners or build with BuildKit remote builders instead of mounting the host socket into jobs.']}],
src:[['Protect the Docker daemon socket',SEC+'protect-access/'],['Rootless mode',E+'security/rootless/']]};

/* ---------- 4: secrets ---------- */
L['docker:8:4']={blocks:[
{p:'A **secret** is data that must stay private: passwords, API keys, tokens, private keys. The goal is simple: **a secret must never end up in an image, a Git repository, a log, or a place that everyone with access to the container can read.**'},
{h:'Where secrets leak'},
{t:[['Mistake','Why it leaks'],
['`COPY .env .` or a key file in the image','Every layer is readable by anyone who can pull the image'],
['`ENV PASSWORD=...` in a Dockerfile','Stored in the image config; `docker inspect` shows it'],
['`ARG TOKEN` build argument','Visible in `docker history`'],
['`docker run -e PASSWORD=...`','Visible in `docker inspect`, shell history and process listings'],
['Logging configuration at start-up','The secret lands in the log system'],
['Committed `.env` or compose files','Secrets in Git history are very hard to remove']]},
{code:`# Proof of how easy it is
docker history --no-trunc myapp | grep -i -E "token|password|key"
docker inspect myapp | grep -i -E "token|password|key"
docker inspect running-container --format '{{json .Config.Env}}'`},
{h:'Better options by stage'},
{t:[['Stage','Mechanism','Section'],
['**Build time**','`RUN --mount=type=secret` and `docker build --secret`','5'],
['**Run time, single host**','Compose `secrets:` (files in `/run/secrets`)','8'],
['**Run time, cluster**','Swarm secrets (encrypted at rest and in transit)','10'],
['**Run time, any platform**','A secret manager: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager','-'],
['**Config that is not secret**','Environment variables or config files','-']]},
{h:'Pattern: read the secret from a file'},
{code:`# Compose
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
secrets:
  db_password:
    file: ./secrets/db_password.txt

# Your own app: read the path from a variable, then the file
import os
pw = open(os.environ["DB_PASSWORD_FILE"]).read().strip()`},
{h:'Good habits'},
{ul:['**Rotate** secrets and prefer **short-lived tokens** over long-lived passwords.','Give each service its **own** credentials with least privilege.','Add `.env`, `*.pem` and `secrets/` to **.gitignore** and **.dockerignore**.','Scan images and repositories for secrets in CI with a secret scanner.','If a secret was ever committed or baked into an image, **treat it as compromised and rotate it.** Deleting the file later is not enough.','Do not print secrets in logs or error messages.']},
{h:'Check list before shipping'},
{flow:['No secret in the Dockerfile, ARG, ENV or COPY','No secret in compose.yaml or .env that is committed','Secrets delivered as files by the platform (or from a vault)','docker history and docker inspect show nothing sensitive','A rotation plan exists']}],
src:[['Manage sensitive data with secrets',K.D+'engine/swarm/secrets/'],['Build secrets',K.B+'building/secrets/'],['Compose secrets',K.C+'how-tos/use-secrets/']]};

/* ---------- 5: Docker Scout ---------- */
L['docker:8:5']={blocks:[
{p:'Every image contains software, and software has **known vulnerabilities**, published as **CVEs** (Common Vulnerabilities and Exposures). **Docker Scout** analyses an image, lists the packages inside it (its **SBOM**), compares them with vulnerability databases and tells you what to fix.'},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**CVE**','A public ID for a known vulnerability, for example CVE-2024-12345'],
['**Severity**','Low, Medium, High, Critical (from the CVSS score)'],
['**SBOM**','Software Bill of Materials: the list of packages and versions in an image'],
['**Fixed version**','The package version that removes the vulnerability (if one exists)'],
['**Base image**','The FROM image; many vulnerabilities come from it']]},
{h:'The main commands'},
{code:`docker scout quickview myapp:1.0                     # one-screen summary
docker scout cves myapp:1.0                          # list the CVEs
docker scout cves --only-severity critical,high myapp:1.0
docker scout cves --only-fixed myapp:1.0             # only those that have a fix
docker scout recommendations myapp:1.0               # which base image update helps most
docker scout compare myapp:1.0 --to myapp:2.0        # what changed between versions
docker scout sbom myapp:1.0                          # package list`},
{p:'Scout is integrated in Docker Desktop and Docker Hub, and the CLI works against local images, images in a registry and even a running environment. Some features require logging in with a Docker account, and advanced policy features depend on your plan.'},
{h:'Reading the result'},
{code:`    Target             │  myapp:1.0     │    0C     2H    14M    31L
      digest           │  5fa1c2e8bd4a  │
    Base image         │  python:3.12-slim-bookworm

  Packages and Vulnerabilities
    0C   1H   2M   0L  openssl 3.0.11-1
    1H                  zlib 1.2.13   fix available: 1.3.1`},
{p:'The figures `0C 2H 14M 31L` mean 0 critical, 2 high, 14 medium and 31 low issues.'},
{h:'What to fix first'},
{flow:['Critical and High severity','That have a fixed version available','In a package your application actually uses (reachable)','In the base image: update the FROM tag first (often fixes many at once)','Then packages you installed: update or remove them']},
{t:[['Finding','Typical action'],
['Many CVEs in the OS base','Move to a newer or slimmer base (`-slim`, distroless, hardened image)'],
['A CVE in your dependency','Upgrade the library and rebuild'],
['No fix available','Assess exposure; consider another package, mitigation or accept the risk with a record'],
['A tool you do not need at run time','Use a multi-stage build so it is not in the final image']]},
{h:'Use it in CI'},
{code:`# Fail the pipeline when critical vulnerabilities exist
docker scout cves --only-severity critical --exit-code myapp:1.0
# exit code is non-zero when a matching vulnerability is found`},
{h:'Other scanners'},
{p:'Scout is one tool. **Trivy**, **Grype** and cloud registry scanners (ECR, ACR, Artifact Registry) do similar work. Use at least one, automatically, on every build **and** on a schedule, because new CVEs appear for images you built months ago.'},
{note:'A clean scan today is not permanent. Rebuild and rescan regularly so base-image fixes reach your images.'}],
src:[['Docker Scout',K.D+'scout/'],['docker scout cves',R+'cli/docker/scout/cves/']]};

/* ---------- 6: minimal and hardened base images ---------- */
L['docker:8:6']={blocks:[
{p:'The less software an image contains, the less there is to attack and to patch. Choosing a **small, well-maintained base** reduces vulnerabilities more than almost any other step.'},
{h:'Base image options'},
{t:[['Base','Size (about)','Has shell and package manager','Notes'],
['`ubuntu`, `debian` (full)','70 to 120 MB','Yes','Familiar, large'],
['`debian:*-slim`','30 to 80 MB','Yes','Debian without extras'],
['`alpine`','5 to 8 MB','Yes (`apk`, busybox)','Uses musl libc; some software behaves differently'],
['**distroless**','2 to 30 MB','**No shell**','Runtime only (libc, certificates, language runtime)'],
['`scratch`','0 MB','No','Empty: for static binaries'],
['**Hardened images**','varies','Usually minimal','Security-focused, with SBOM and provenance']]},
{h:'Distroless'},
{p:'Distroless images (for example `gcr.io/distroless/static`, `.../base`, `.../python3`, `.../nodejs`) contain only the application runtime and its dependencies. There is no shell, no package manager and no common tools, so an attacker who gets in has very little to work with.'},
{code:`FROM golang:1.23 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /app .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /app /app
ENTRYPOINT ["/app"]`},
{ul:['The \`:nonroot\` tag already sets a non-root user.','Debugging is harder because `docker exec sh` fails. Use a debug variant or an ephemeral debug container (Section 11).','Multi-stage builds (Section 5) make distroless easy.']},
{h:'Docker Hardened Images'},
{p:'**Docker Hardened Images (DHI)** are minimal, security-focused base images maintained by Docker, published with **SBOMs and provenance attestations**, and built to have very few known vulnerabilities. Docker has made them **free and open source**, so they are a practical default choice for many base images. Check the Docker catalog for the images available and the current terms.'},
{h:'How to choose'},
{flow:['Can it be a static binary? Use scratch or distroless static','Interpreted language? Use the official slim variant, a distroless runtime or a hardened image','Need a shell for operations? Use a slim base but keep it patched','Pin the version and digest, rebuild often and rescan']},
{t:[['Practice','Reason'],
['Use a multi-stage build','Compilers and tools stay out of the final image'],
['Pin tags and digests','Reproducible and reviewable updates'],
['Remove package manager caches and tools you do not use','Smaller attack surface'],
['Prefer images with SBOM and provenance','You can audit what is inside'],
['Update the base regularly','Security fixes arrive in new base builds']]},
{note:'Alpine is small but uses **musl** instead of glibc. Some Python wheels and compiled libraries behave differently or need extra packages. Test before switching.'}],
src:[['Dockerfile best practices: base images',K.B+'building/best-practices/#choose-the-right-base-image'],['Distroless','https://github.com/GoogleContainerTools/distroless'],['Docker Hardened Images',K.D+'dhi/']]};

/* ---------- 7: content trust and signing ---------- */
L['docker:8:7']={blocks:[
{p:'When you pull `nginx:1.27` you trust that the registry returned what the publisher intended. **Image signing** lets you verify **who published** an image and that it **has not been changed** since. The idea: the publisher signs the image with a private key; you verify with the public key.'},
{flow:['Publisher builds the image and signs its digest with a private key','The signature is stored in a registry or trust service','Consumer pulls the image and its signature','The consumer verifies the signature with the publisher public key','If it does not match, the pull or deploy is refused']},
{h:'Docker Content Trust (DCT)'},
{p:'DCT is Docker built-in signing, based on **Notary**. It signs image **tags** on push and verifies them on pull when enabled.'},
{code:`export DOCKER_CONTENT_TRUST=1          # verify on pull, sign on push
docker pull alpine:3.20                  # only signed tags work
docker push myorg/web:1.0                # signs the tag (creates keys on first use)

docker trust inspect --pretty myorg/web:1.0   # who signed it
docker trust sign myorg/web:1.0               # sign an existing image
docker pull unsigned/image:latest             # fails: no trust data for latest`},
{t:[['Key','Purpose'],
['Root key (offline)','Master key; keep it safe and offline'],
['Repository (targets) key','Signs tags for a repository'],
['Timestamp / snapshot keys','Managed by the service; protect freshness of data']]},
{note:'DCT must be switched on per shell with `DOCKER_CONTENT_TRUST=1`. Without it, Docker does not verify anything. Losing the root key means losing control of the signed repository.'},
{h:'The wider ecosystem'},
{p:'DCT is older technology. Most new projects use newer, more flexible tools:'},
{t:[['Tool','What it is'],
['**Sigstore cosign**','Signs and verifies container images, supports keyless signing with identity (OIDC)'],
['**Notation (Notary v2)**','OCI-native signing, used by several cloud registries'],
['**SBOM and provenance attestations**','Signed statements about what is in the image and how it was built (BuildKit can attach them)'],
['**Admission policies**','Kubernetes and other platforms reject unsigned images (Kyverno, OPA Gatekeeper, cloud policies)']]},
{code:`# cosign example (keyless, in CI)
cosign sign myorg/web@sha256:3f1c...
cosign verify myorg/web@sha256:3f1c... --certificate-identity "https://github.com/myorg/web/.github/workflows/release.yml@refs/heads/main" --certificate-oidc-issuer https://token.actions.githubusercontent.com`},
{h:'Practical advice'},
{ul:['Always deploy by **digest** and verify the signature of that digest.','Prefer **Official** and **Verified Publisher** images, and mirror them into your private registry after verification.','Sign what **you** build in CI and enforce verification in the deployment platform.','Signing proves **origin and integrity**, not that the software is free of vulnerabilities. Combine with scanning.']}],
src:[['Docker Content Trust',E+'security/trust/'],['docker trust',R+'cli/docker/trust/'],['Sigstore cosign','https://docs.sigstore.dev/cosign/']]};

/* ---------- 8: practical ---------- */
L['docker:8:8']={blocks:[
{p:'**Goal:** take an **insecure** container, measure its weaknesses and harden it step by step: non-root user, dropped capabilities, no-new-privileges, read-only file system and resource limits.'},
{flow:['Run the insecure version and list its weaknesses','Add a non-root user','Drop capabilities and block privilege gain','Make the root file system read-only','Add resource limits','Verify each control']},
{h:'Step 1: the insecure start'},
{code:`docker run -d --name bad -p 8081:80 nginx:1.27
docker exec bad id                                       # uid=0(root)
docker exec bad sh -c "touch /etc/hacked && echo wrote /etc"    # can write anywhere
docker inspect -f 'caps-drop={{.HostConfig.CapDrop}} readonly={{.HostConfig.ReadonlyRootfs}} mem={{.HostConfig.Memory}}' bad
docker exec bad sh -c "grep Cap /proc/1/status"          # many capabilities present`},
{h:'Step 2: a hardened image (non-root nginx)'},
{code:`mkdir hardening && cd hardening
cat > nginx.conf <<'EOF'
pid /tmp/nginx.pid;
events {}
http {
  client_body_temp_path /tmp/c; proxy_temp_path /tmp/p; fastcgi_temp_path /tmp/f;
  uwsgi_temp_path /tmp/u; scgi_temp_path /tmp/s;
  access_log /dev/stdout; error_log /dev/stderr;
  server { listen 8080; location / { return 200 "hardened\\n"; } }
}
EOF`},
{p:'The config uses port **8080** (no privileged port) and writes only to **/tmp**, so the container can run as a non-root user with a read-only file system.'},
{h:'Step 3: run with every control'},
{code:`docker run -d --name good -p 8082:8080 \\
  --user 10001:10001 \\
  --cap-drop ALL \\
  --security-opt no-new-privileges \\
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m \\
  --memory 64m --cpus 0.5 --pids-limit 50 \\
  -v "$PWD/nginx.conf":/etc/nginx/nginx.conf:ro \\
  nginx:1.27

curl http://localhost:8082            # hardened
docker logs good | tail -3`},
{h:'Step 4: verify each control'},
{code:`docker exec good id                                          # uid=10001
docker exec good sh -c "touch /etc/x"  2>&1 | head -1        # Read-only file system
docker exec good sh -c "touch /tmp/ok && echo tmp is writable"
docker exec good sh -c "grep CapEff /proc/1/status"          # CapEff: 0000000000000000
docker inspect -f 'readonly={{.HostConfig.ReadonlyRootfs}} mem={{.HostConfig.Memory}} pids={{.HostConfig.PidsLimit}}' good
docker stats --no-stream good`},
{h:'Step 5: try to attack the hardened container'},
{code:`docker exec good sh -c "chown root /tmp"            # not permitted: no CAP_CHOWN
docker exec -u 0 good sh -c "id" 2>&1 | head -1       # exec as root still possible through the daemon!
# Controls inside the container do not protect against someone who controls the daemon (lecture 4).`},
{note:'The lines above are a reminder: a hardened container is still only as safe as the **daemon access** around it.'},
{h:'Scorecard'},
{t:[['Control','Insecure','Hardened'],
['User','root','10001'],
['Capabilities','default set','none'],
['Privilege escalation','possible','no-new-privileges'],
['Root file system','writable','read-only (+ tmpfs /tmp)'],
['Memory / CPU / PIDs','unlimited','64 MB / 0.5 / 50'],
['Port','80 (privileged)','8080']]},
{h:'Cleanup'},
{code:`docker rm -f bad good
cd .. && rm -rf hardening`},
{h:'Stretch goals'},
{ul:['Scan `nginx:1.27` with `docker scout quickview` and compare with a hardened or distroless base.','Add `--security-opt seccomp=./profile.json` with a custom profile.','Enable `DOCKER_CONTENT_TRUST=1` and observe what happens to unsigned images.','Express the same controls in a Compose file (`user`, `cap_drop`, `read_only`, `tmpfs`, `security_opt`).']}],
src:[['Docker security',SEC],['docker run security options',R+'cli/docker/container/run/#security-opt']]};
})();
