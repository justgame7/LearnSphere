/* LearnSphere - Docker, Section 12: CI/CD, Production Readiness & Capstone.
   Lectures 0-4 are core, 5-10 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;

/* ---------- diagrams ---------- */
const promo=K.dg(700,200,[
[10,60,120,56,'CI build|app:sha-a1b2c3',2],[170,60,130,56,'Dev registry|tested by CI',0],[340,60,130,56,'Staging|same digest|extra tests',0],[510,60,180,56,'Production registry|tag 1.4.2 added|SAME digest',2],
[170,140,520,40,'The image bytes never change between stages: only tags and registries are added',0]],
[[130,88,170,88],[300,88,340,88],[470,88,510,88]]);

const pipe=K.dg(700,170,[
[10,60,100,50,'Push code|or open PR',0],[140,60,100,50,'Build|BuildKit',2],[270,60,100,50,'Test|in a container',0],[400,60,100,50,'Scan|Scout / Trivy',0],[530,60,160,50,'Push to registry|then deploy',2]],
[[110,85,140,85],[240,85,270,85],[370,85,400,85],[500,85,530,85]]);

/* ---------- 0: production readiness ---------- */
L['docker:11:0']={blocks:[
{p:'A container that works on your laptop is not yet **ready for production**. Production means real users, real failures and real attackers. This checklist collects everything from the course; use it as a **gate** before any container goes live.'},
{h:'The checklist'},
{t:[['Area','Check','Section'],
['**Image**','Small, trusted, pinned base (tag and ideally digest)','4, 5, 9'],
['','Multi-stage build, no build tools or secrets in the final image','5'],
['','Scanned; no unaccepted critical or high vulnerabilities','9'],
['**Process**','Runs as a **non-root** user','9'],
['','Exec-form CMD/ENTRYPOINT; handles SIGTERM (graceful stop)','5'],
['','One main process; logs to stdout/stderr','3, 11'],
['**Health**','HEALTHCHECK defined and cheap','3'],
['','Restart policy (`unless-stopped`) or orchestrator rescheduling','3, 10'],
['**Resources**','Memory and CPU limits, PID limit','3'],
['**Security**','Capabilities dropped, `no-new-privileges`, read-only root, default seccomp','9'],
['','No `--privileged`, no docker.sock mount, no host path mounts that are not needed','7, 9'],
['**Secrets**','Delivered as files or from a vault; none in image, ENV or Git','9'],
['**Network**','Only needed ports published; internal networks for data tiers','6'],
['**Data**','Persistent data on volumes; backup and **tested restore**','7'],
['**Logging and monitoring**','Rotation or central logs; metrics and alerts on restarts, OOM, disk','11'],
['**Versions**','Immutable tags or digests; deploy never uses `latest`','4, 12'],
['**Operations**','Rollback plan; runbook; documented owner','10, 11']]},
{h:'A production-grade Compose service'},
{code:`services:
  api:
    image: registry.example.com/shop/api@sha256:3f1c...    # pinned by digest
    user: "10001:10001"
    read_only: true
    tmpfs: ["/tmp:size=16m,noexec,nosuid"]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    restart: unless-stopped
    init: true
    stop_grace_period: 30s
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8000/health"]
      interval: 15s
      timeout: 3s
      retries: 3
      start_period: 20s
    deploy:
      resources:
        limits: { cpus: "1.0", memory: 512M }
    logging:
      driver: local
      options: { max-size: "10m", max-file: "3" }
    secrets: [db_password]
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password
    networks: [back]
    ports:
      - "127.0.0.1:8000:8000"       # reachable only through the reverse proxy on this host
secrets:
  db_password:
    file: ./secrets/db_password.txt
networks:
  back: {}`},
{h:'Graceful shutdown'},
{flow:['The platform sends SIGTERM (docker stop, rolling update, node drain)','The app stops accepting new requests','It finishes in-flight work and closes connections','It exits with code 0 before the grace period ends','Otherwise Docker sends SIGKILL and requests are lost']},
{p:'Test it: `docker stop` should return **quickly** (seconds, not the full timeout). If it takes 10 seconds every time, your process is not receiving SIGTERM (shell-form CMD, or no signal handler).'},
{h:'Rollback plan'},
{ul:['Keep the **previous image digest** and previous Compose or stack file in version control.','Rolling back = redeploy the old digest. Practise it **before** you need it.','If the new version changed a **database schema**, plan backward-compatible migrations (add first, remove later).']},
{h:'Readiness review in one table'},
{t:[['Question','Evidence you can show'],
['Can it be rebuilt exactly?','Dockerfile, pinned versions, CI log'],
['Can it be updated without downtime?','Rolling update with health checks demonstrated'],
['Can it recover from a crash and a node loss?','Kill tests performed'],
['Can we restore the data?','A restore test with a date'],
['Do we know when it breaks?','Alerts and a dashboard'],
['Is it safe?','Scan report, non-root, limited capabilities, no secrets']]},
{note:'A readiness checklist is only useful if it is **enforced**: put it in your pull request template and CI checks (Hadolint, Scout or Trivy, `docker build --check`).'}],
src:[['Dockerfile best practices',K.B+'building/best-practices/'],['Docker security',E+'security/'],['Compose in production',K.C+'how-tos/production/']]};

/* ---------- 1: tagging, digests, promotion ---------- */
L['docker:11:1']={blocks:[
{p:'Production safety depends on one rule: **the image you tested is the image you deploy.** Tags can move; **digests cannot**. A good release process builds once, identifies the image by its digest, and **promotes** that same image through environments.'},
{svg:promo},
{h:'Build once, promote many times'},
{t:[['Wrong way','Right way'],
['Rebuild the image for staging and again for production','Build **once** in CI'],
['Deploy `app:latest` everywhere','Deploy by **digest** (or an immutable version tag)'],
['Production gets different bytes than were tested','Production gets **exactly** the tested bytes'],
['"It worked in staging" is not proof','The digest in production equals the digest tested']]},
{h:'A tagging strategy'},
{t:[['Tag','Example','Meaning','Moves?'],
['Commit tag','`sha-a1b2c3d`','Exact source revision, set by CI','Never'],
['Release tag','`1.4.2`','A released version, added at promotion','Never (immutable)'],
['Minor / major','`1.4`, `1`','Latest patch of that line (optional)','Yes'],
['Environment','`staging`, `prod`','What runs where (optional, prefer digests in manifests)','Yes'],
['`latest`','`latest`','Convenience for humans only','Yes: never deploy it']]},
{h:'Promote with no rebuild'},
{code:`# 1. CI builds and pushes by commit
docker buildx build -t registry.example.com/dev/shop-api:sha-a1b2c3d --push .

# 2. Record the digest
DIGEST=$(docker buildx imagetools inspect registry.example.com/dev/shop-api:sha-a1b2c3d --format '{{json .Manifest.Digest}}' | tr -d '"')
echo $DIGEST        # sha256:3f1c...

# 3. Promote to production: copy the same manifest (all platforms, same digest) and add a release tag
docker buildx imagetools create \\
  -t registry.example.com/prod/shop-api:1.4.2 \\
  registry.example.com/dev/shop-api@$DIGEST

# 4. Verify the digest is identical
docker buildx imagetools inspect registry.example.com/prod/shop-api:1.4.2 | grep Digest`},
{ul:['`imagetools create` copies the manifest **without rebuilding or re-pulling layers locally**, preserving the digest and multi-platform entries.','Alternative: `docker pull`, `docker tag`, `docker push` (works for a single platform; the digest stays the same for the same manifest).','Registry tools such as `crane copy` or your registry built-in **replication** do the same.']},
{h:'Deploy by digest'},
{code:`# Compose / stack file
services:
  api:
    image: registry.example.com/prod/shop-api:1.4.2@sha256:3f1c...    # tag for people, digest for safety

# Find the digest of what is running
docker inspect --format '{{index .RepoDigests 0}}' shop-api
docker service inspect shop_api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'`},
{h:'Metadata that helps later'},
{code:`# OCI labels set at build time
docker buildx build \\
  --label org.opencontainers.image.revision=$(git rev-parse HEAD) \\
  --label org.opencontainers.image.source=https://github.com/acme/shop \\
  --label org.opencontainers.image.version=1.4.2 \\
  -t registry.example.com/dev/shop-api:sha-$(git rev-parse --short HEAD) --push .`},
{h:'Registry hygiene'},
{ul:['Turn on **immutable tags** for release tags where your registry supports it.','Use **separate repositories or registries** per stage and give production **read-only** access to the build system.','Set a **retention policy** (keep releases and the last N builds; expire the rest).','Keep every released digest long enough to **roll back**.','Sign released images and verify signatures at deploy time (Section 9).']},
{flow:['CI builds the image and tags it with the commit','Tests and scans run against that tag','Passing builds are promoted by adding a release tag and copying to the production registry','Deployment references the digest','Rollback means redeploying the previous digest']}],
src:[['docker buildx imagetools',R+'cli/docker/buildx/imagetools/'],['Pin base image versions',K.B+'building/best-practices/#pin-base-image-versions'],['OCI annotations','https://github.com/opencontainers/image-spec/blob/main/annotations.md']]};

/* ---------- 2: Docker in CI/CD ---------- */
L['docker:11:2']={blocks:[
{p:'**CI/CD** (continuous integration and delivery) runs your build, tests and release **automatically** on every change. Docker fits perfectly: the image is the artifact, and the same container runs in CI and in production.'},
{svg:pipe},
{h:'What a pipeline does'},
{t:[['Stage','Purpose','Docker feature'],
['**Build**','Make the image from the Dockerfile','BuildKit, cache export'],
['**Test**','Run unit and integration tests inside the image','`--target test`, Compose services for databases'],
['**Scan**','Find vulnerabilities and secrets','Docker Scout, Trivy, Hadolint'],
['**Push**','Publish to a registry','Tags from commit and release'],
['**Deploy**','Update the environment','Compose, Swarm, Kubernetes; by digest']]},
{h:'A GitHub Actions workflow'},
{code:`# .github/workflows/docker.yml
name: docker
on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:

permissions:
  contents: read
  packages: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Image tags and labels
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/\${{ github.repository }}
          tags: |
            type=sha
            type=semver,pattern={{version}}
            type=ref,event=branch

      - name: Run tests (test stage of the Dockerfile)
        uses: docker/build-push-action@v6
        with:
          context: .
          target: test
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push
        id: push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: true
          sbom: true

      - name: Scan the image
        if: github.event_name != 'pull_request'
        uses: docker/scout-action@v1
        with:
          command: cves
          image: ghcr.io/\${{ github.repository }}@\${{ steps.push.outputs.digest }}
          only-severities: critical,high
          exit-code: true`},
{p:'Version tags of actions (`@v4`, `@v3`...) change over time; check the current versions on each action page.'},
{h:'Pieces explained'},
{t:[['Action','What it does'],
['`setup-buildx-action`','Creates a BuildKit builder with full features'],
['`login-action`','Logs in to a registry (use the **secrets** store, never plain text)'],
['`metadata-action`','Computes tags and labels from branch, tag and commit'],
['`build-push-action`','Builds (and pushes) with caching and attestations'],
['`scout-action` or Trivy action','Scans the pushed image by **digest**']]},
{h:'Speed up with the build cache'},
{ul:['`cache-from` / `cache-to` with `type=gha` stores layers in the CI cache; `type=registry` stores them in a registry image.','Keep the Dockerfile ordered so that dependencies cache (Section 5).','Build for several platforms with `platforms: linux/amd64,linux/arm64` (needs QEMU or native runners).']},
{h:'Deploy step ideas'},
{code:`# Simple: SSH to a server and update a Compose stack by digest
ssh deploy@server "cd /srv/shop && docker compose pull && docker compose up -d --wait"

# Remote context from the runner
docker context create prod --docker "host=ssh://deploy@server"
docker --context prod compose up -d --wait

# Swarm
docker --context prod stack deploy -c stack.yaml --with-registry-auth shop`},
{h:'CI/CD rules of thumb'},
{ul:['**Never** put secrets in the repository or in build arguments; use the CI secret store and `--secret` mounts.','Run the **same image** you will ship in the test stage; do not test one build and ship another.','Block merges on failing tests and critical vulnerabilities.','Use **short-lived credentials** (OIDC to the cloud) instead of long-lived passwords.','Deploy by **digest** and keep rollback one command away.','Do not mount the host Docker socket into CI jobs; use dedicated runners or remote builders.']},
{note:'Other CI systems (GitLab CI, Jenkins, Azure Pipelines, CircleCI) follow the same stages. Only the YAML syntax changes.'}],
src:[['Docker build in GitHub Actions',K.D+'build/ci/github-actions/'],['docker/build-push-action','https://github.com/docker/build-push-action'],['Cache management in CI',K.B+'ci/github-actions/cache/']]};

/* ---------- 3: Compose vs Swarm vs Kubernetes ---------- */
L['docker:11:3']={blocks:[
{p:'You now know three ways to run containers. There is no best one, only the **right one for the workload, the team and the risk**. This guide helps you choose and shows how your Docker skills carry into Kubernetes.'},
{svg:K.dg(700,170,[
[10,40,200,90,'Compose|one host|simple, great for dev|and small production',2],[250,40,200,90,'Swarm|a few to dozens of hosts|simple orchestration',0],[490,40,200,90,'Kubernetes|many hosts, many teams|powerful, complex',0]],
[[210,85,250,85],[450,85,490,85]])},
{h:'Comparison'},
{t:[['','Docker Compose','Docker Swarm','Kubernetes'],
['Scope','One host','Cluster','Cluster (very large scale)'],
['Learning curve','Easy','Easy to moderate','Steep'],
['High availability','No (host is a single point of failure)','Yes (several managers and workers)','Yes (rich options)'],
['Rolling updates, rollback','Manual','Built in','Built in, many strategies'],
['Autoscaling','No','No (manual scale)','Yes (HPA, VPA, cluster autoscaler)'],
['Networking and load balancing','Bridge networks','Overlay + routing mesh','CNI plugins, Services, Ingress/Gateway'],
['Storage','Volumes','Volumes and plugins','PersistentVolumes, StorageClasses, CSI'],
['Ecosystem and managed services','Small','Small','Very large; every cloud offers it'],
['Operations effort','Minimal','Low','High (or pay for managed)'],
['Config format','compose.yaml','compose.yaml + deploy','YAML manifests, Helm, Kustomize']]},
{h:'Decision guide'},
{flow:['One server, a few services, a small team? Use Compose (with good backups).','Need to survive a server failure, but want simplicity? Use Swarm.','Need autoscaling, many teams, a big ecosystem or a managed cloud platform? Use Kubernetes.','Unsure? Start with Compose; the files and images move forward with you.']},
{t:[['Situation','Recommendation'],
['Developer laptop, tests and CI','Compose'],
['Small internal app on one VM','Compose, with restart policies and backups'],
['A few services, a small ops team, modest scale','Swarm'],
['Dozens of services, several teams, autoscaling and multi-cloud','Kubernetes'],
['Company already has a Kubernetes platform','Kubernetes: follow the platform'],
['Short-lived or very small workloads without ops staff','A managed container service (such as AWS ECS, Azure Container Apps, Cloud Run)']]},
{h:'Be honest about Swarm'},
{ul:['Swarm is **maintained and stable**, but its community and ecosystem are much smaller than Kubernetes.','Hiring and tooling favour Kubernetes; plan for the future of your team.','Swarm remains a good fit where **simplicity** matters most.']},
{h:'Moving on to Kubernetes'},
{p:'Everything you learned maps directly. Images, registries, Dockerfiles, health checks, resource limits, secrets and the idea of **desired state** all carry over.'},
{t:[['Docker concept','Kubernetes equivalent'],
['Image, registry','Same (OCI images)'],
['Container','Container inside a **Pod**'],
['Service (Swarm), compose service','**Deployment** + **Service**'],
['Replicas, rolling update, rollback','Deployment `replicas`, strategy, `rollout undo`'],
['Overlay network, routing mesh','Cluster network (CNI), **Service**, **Ingress**'],
['Volume','**PersistentVolumeClaim** / Volume'],
['Secret, config','**Secret**, **ConfigMap**'],
['Health check','Liveness, readiness, startup **probes**'],
['`docker stack deploy`','`kubectl apply`, **Helm**'],
['Resource limits','`resources.requests` and `limits`'],
['Node drain','`kubectl drain`'],
['Compose to Kubernetes','Compose Bridge, or tools such as Kompose']]},
{note:'Next step: the **Kubernetes Administrator** course in this app (CKA-aligned) builds a cluster, deploys and secures workloads, and troubleshoots them.'}],
src:[['Swarm mode overview',E+'swarm/'],['Kubernetes documentation','https://kubernetes.io/docs/home/'],['Compose Bridge',K.C+'bridge/']]};

/* ---------- 4: capstone ---------- */
L['docker:11:4']={blocks:[
{p:'**Capstone:** you build, secure, ship and operate a multi-container application, then fix faults that someone else injects. It uses every section of the course. Treat it as a small real project: Git repository, Dockerfiles, Compose file, CI pipeline, registry, deployment and runbook.'},
{svg:K.dg(700,230,[
[10,10,680,210,'Capstone system',1],
[30,45,120,50,'Developer|git push',0],[180,45,120,50,'CI pipeline|build, test,|scan, push',2],[330,45,130,50,'Registry|images by digest',0],[490,45,180,50,'Server (Compose or Swarm)',2],
[490,115,85,50,'proxy|:443',0],[585,115,85,50,'api',0],[490,175,85,35,'db + volume',0],[585,175,85,35,'cache',0]],
[[150,70,180,70],[300,70,330,70],[460,70,490,70],[532,95,532,115],[627,95,627,115]])},
{h:'The application'},
{p:'Choose any small web app (the Flask app from earlier sections works) with at least: a **reverse proxy**, an **API**, a **database** and a **cache**. Four containers, two networks, one volume.'},
{h:'Milestones and acceptance criteria'},
{t:[['#','Milestone','You are done when...','Sections'],
['1','**Containerize**','Dockerfile per service: pinned base, multi-stage, non-root, health check, `.dockerignore`, image under a size target you set','4, 5'],
['2','**Compose**','`docker compose up -d --wait` starts everything; services healthy; data persists after `down` and `up`','7, 8'],
['3','**Network design**','Only the proxy is published; database and cache are on an `internal` network','6'],
['4','**Harden**','Non-root, `cap_drop: [ALL]`, read-only root, limits, no secrets in env, scan has no unaccepted critical issues','9'],
['5','**CI pipeline**','On push: build, test, scan, push by commit tag; on tag: promote the same digest to `1.0.0`','5, 12'],
['6','**Deploy**','Deploy by digest to a server (remote context over SSH) or a Swarm; rolling update works with zero failed requests','2, 10'],
['7','**Observe**','Logs rotate or ship centrally; metrics visible; alerts defined for restarts, OOM and disk','11'],
['8','**Backup and restore**','Database backup script, and a documented **restore test**','7'],
['9','**Break/fix**','Find and fix faults injected by a reviewer (below)','11'],
['10','**Runbook**','A one-page table: symptom, first command, usual cause, fix','11']]},
{h:'Fault injection (do this to yourself or a partner)'},
{t:[['Fault','Expected detection','Expected fix'],
['Kill the database container (`docker kill`)','Health check fails, restart policy brings it back','Verify data intact; the API reconnects'],
['Set a 20 MB memory limit on the API','`OOMKilled`, exit 137, restart loop','Raise limit; find memory use with `docker stats`'],
['Break `daemon.json` with a trailing comma and restart Docker','Daemon will not start; `journalctl` shows the JSON error','Validate and fix; restore backup file'],
['Deploy an image with a wrong tag','`manifest unknown` / task rejected','Fix the tag; roll back to the previous digest'],
['Put API and database on different networks','Name resolution fails','Attach to a shared internal network'],
['Fill the disk with logs','`no space left on device`, containers fail','Prune, add log rotation, alert on disk'],
['Remove a volume with `docker volume rm` after stopping the DB','Database empty on restart','Restore from the backup you tested'],
['Introduce a vulnerable base image','CI scan fails the build','Update the base, rebuild, rescan']]},
{h:'Suggested order of work'},
{flow:['Write Dockerfiles and verify each image alone','Combine into compose.yaml with networks, volumes, health checks and secrets','Add the hardening options and scan','Create the repository and CI workflow','Deploy to a server by digest and perform a rolling update','Add logging, monitoring and alerts','Write and test the backup and restore','Run the fault injections and write the runbook']},
{h:'Self-assessment rubric'},
{t:[['Area','Beginner','Competent','Production-ready'],
['Images','Runs','Small, cached, non-root','Pinned digest, scanned, SBOM, signed'],
['Compose','One file works','Profiles, secrets, health-based start','Environment overrides, resource limits, tested rollback'],
['Networking','Everything published','Custom networks','Internal tiers, only proxy public, firewall-aware'],
['Data','No volumes','Named volumes','Backups, tested restores, retention'],
['CI/CD','Manual build','CI builds and tests','Build once, promote by digest, automatic scans'],
['Operations','Reads logs by hand','Log rotation, health checks','Metrics, alerts, runbook, rehearsed failures']]},
{h:'Exam preparation tie-in'},
{ul:['Map each milestone to a DCA domain: **Installation** (2), **Images** (4,5), **Networking** (6), **Storage** (7), **Security** (9), **Orchestration** (10).','Be able to explain every command you used and its effect, not only run it.','Practise without notes: build the capstone twice, the second time from a blank folder.']},
{note:'Keep the repository, the runbook and your notes. They are a portfolio of real, working Docker skills.'}],
src:[['Docker get started',K.D+'get-started/'],['Docker Certified Associate','https://training.mirantis.com/certification/dca-certification-exam/']]};
})();
