/* LearnSphere - DevOps & CI/CD, Section 09: Artifacts, Registries & Container Builds.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const promote=K.dg(700,220,[
[10,10,680,200,'Build once, promote the same artifact',1],
[25,70,110,60,'Commit',0],[165,70,120,60,'Build|image sha256:ab12',2],
[330,30,110,40,'Test env',0],[330,90,110,40,'Staging',0],[330,150,110,40,'Production',0],
[500,70,170,60,'Same digest in every|environment',0]],
[[135,100,165,100],[285,100,330,50],[285,100,330,110],[285,100,330,170],[440,110,500,100]]);

const layers=K.dg(700,260,[
[10,10,680,240,'Layer order and cache reuse',1],
[40,50,180,40,'FROM node:22-slim',0],[40,100,180,40,'COPY package*.json',0],[40,150,180,40,'RUN npm ci',0],[40,200,180,34,'COPY src/ (changes often)',2],
[260,50,180,40,'cached',0],[260,100,180,40,'cached unless lock changes',0],[260,150,180,40,'cached unless lock changes',0],[260,200,180,34,'rebuilt on every change',2],
[480,70,190,120,'Put rarely changing|steps first. Copy the|source last so code|edits reuse the|dependency layer.',0]],
[[220,70,260,70],[220,120,260,120],[220,170,260,170],[220,217,260,217]]);

/* ---------- 0 ---------- */
L['devops:8:0']={blocks:[
{p:'**Build once, promote** means the pipeline produces a single, immutable artifact per commit and moves **that same artifact** through test, staging and production. Only configuration changes between environments.'},
{svg:promote},
{h:'Why not rebuild per environment?'},
{t:[['Rebuild per environment','Build once and promote'],
['Each build can differ (dependencies, tools, time)','One artifact, one set of bytes'],
['Test results do not apply to the production build','What was tested is what ships'],
['Slow, repeated work','Fast promotion'],
['Hard to trace what runs where','Digest or version identifies it everywhere']]},
{h:'What this requires'},
{ul:['**Immutable** artifacts: never overwrite a published version.','**Configuration outside** the artifact (environment variables, config maps).','A **registry** or repository that stores artifacts with stable identifiers (version or digest).','Promotion as a **metadata change** (retag, copy to another repository, update a manifest) instead of a rebuild.']},
{note:'If production needs a different build than staging, the difference is configuration. Move it out of the artifact and the pipeline gets simpler and safer.'}],
src:[['DORA: deployment automation',K.DORA+'capabilities/deployment-automation/']]};

/* ---------- 1 ---------- */
L['devops:8:1']={blocks:[
{p:'A **container registry** stores and serves container images. The OCI standard makes them largely interchangeable, so you choose by access control, cost, scanning, location and ecosystem fit.'},
{t:[['Registry','Typical home','Notes'],
['**Docker Hub**','Public images, official images','Rate limits for anonymous and free pulls'],
['**GHCR** (GitHub Container Registry)','GitHub projects','Tied to GitHub permissions; works with `GITHUB_TOKEN`'],
['**GitLab Container Registry**','GitLab projects','Built in, per project'],
['**Amazon ECR**','AWS workloads','IAM auth, scanning, replication'],
['**Azure Container Registry (ACR)**','Azure workloads','Entra ID auth, geo-replication'],
['**Google Artifact Registry**','Google Cloud workloads','Also hosts language packages'],
['**Harbor**','Self-hosted, open source','Policies, replication, scanning, signing']]},
{h:'Selection criteria'},
{ul:['**Location**: keep images close to where they run to cut pull time and egress cost.','**Identity**: can the registry authenticate your pipeline and clusters with short-lived credentials?','**Policy**: immutable tags, retention rules, vulnerability scanning and signature support.','**Availability**: a registry outage stops deployments, so plan for it.']},
{note:'Pull-through caches (a local mirror of Docker Hub) protect you from rate limits and upstream outages.'}],
src:[['OCI image spec','https://github.com/opencontainers/image-spec'],['GitHub Container registry',K.GHD+'packages/working-with-a-github-packages-registry/working-with-the-container-registry']]};

/* ---------- 2 ---------- */
L['devops:8:2']={blocks:[
{p:'A **multi-stage build** compiles in one stage and copies only the output into a small runtime stage. The result is a smaller, faster and safer image because compilers and source never ship.'},
{code:`# syntax=docker/dockerfile:1
FROM node:22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]`},
{t:[['Practice','Benefit'],
['Multi-stage builds','Small final image, fewer vulnerabilities'],
['Minimal or distroless base','Smaller attack surface'],
['Run as a non-root user','Limits damage from a compromise'],
['`.dockerignore`','Keeps secrets and junk out of the build context'],
['Pin base image versions or digests','Repeatable builds'],
['No secrets in layers','Layers are permanent and readable']]},
{note:'This builds on the Docker course. Use `docker build --secret` or BuildKit secret mounts for build-time secrets so they never enter an image layer.'}],
src:[['Multi-stage builds',K.DK+'build/building/multi-stage/'],['Dockerfile best practices',K.DK+'build/building/best-practices/']]};

/* ---------- 3 ---------- */
L['devops:8:3']={blocks:[
{p:'**BuildKit** is Docker\'s modern build engine. It builds independent stages in parallel and caches every layer. Pipelines start on clean runners, so cache must be **restored** from somewhere between runs.'},
{svg:layers},
{h:'Sharing cache between runs'},
{t:[['Cache backend','How','Notes'],
['**Registry cache**','`--cache-to type=registry` and `--cache-from`','Works on any CI, stored with images'],
['**Platform cache**','`type=gha` for GitHub Actions','Convenient, subject to cache limits'],
['**Persistent runner**','Docker layer cache on a long-lived builder','Fast, but state carries over']]},
{code:`docker buildx build \\
  --cache-from type=registry,ref=registry.example.com/app:buildcache \\
  --cache-to   type=registry,ref=registry.example.com/app:buildcache,mode=max \\
  -t registry.example.com/app:\${GIT_SHA} \\
  --push .`},
{h:'Layer ordering rules'},
{ul:['Copy dependency manifests and install first, copy source later.','Combine commands that must change together; split ones that change at different speeds.','Keep the build context small with `.dockerignore`.']}],
src:[['BuildKit',K.DK+'build/buildkit/'],['Cache backends',K.DK+'build/cache/backends/']]};

/* ---------- 4 ---------- */
L['devops:8:4']={blocks:[
{p:'An image tag is a **label that can be moved**. A **digest** (`sha256:...`) is derived from the content and cannot change. Choosing how to reference images decides how reproducible and safe your deployments are.'},
{t:[['Reference','Mutable?','Use'],
['`app:latest`','Yes, moves with every push','Avoid for deployments'],
['`app:1.4.2`','Can be re-pushed unless the registry enforces immutability','Human-friendly release version'],
['`app:3f2a9c8`','Unique per commit','Traceable to code'],
['`app@sha256:ab12...`','No','Exact reproducibility']]},
{code:`# Tag by version and commit, push, and capture the digest
docker build -t registry.example.com/app:1.4.2 -t registry.example.com/app:3f2a9c8 .
docker push registry.example.com/app --all-tags
docker inspect --format='{{index .RepoDigests 0}}' registry.example.com/app:1.4.2
# registry.example.com/app@sha256:ab12...`},
{h:'Rules'},
{ul:['Never deploy `latest`. You cannot tell what is running or roll back to what it was.','Turn on **tag immutability** in the registry so published tags cannot be overwritten.','Deploy by **digest** (or a tag that you resolve to a digest in the pipeline) and record it.','Sign and attest the digest, not a tag (Section 14).']}],
src:[['Pull an image by digest',K.DK+'reference/cli/docker/image/pull/#pull-an-image-by-digest-immutable-identifier']]};

/* ---------- 5 ---------- */
L['devops:8:5']={blocks:[
{p:'Applications depend on language **packages**. Hosting them internally gives you control, caching and a place to publish your own libraries.'},
{t:[['Ecosystem','Package','Client','Typical registry'],
['JavaScript','npm','npm, pnpm, yarn','npm registry, GitHub Packages, Artifactory'],
['Java','Maven or Gradle artifacts','mvn, gradle','Maven Central, Artifactory, Nexus'],
['Python','wheels, sdists','pip, uv, poetry','PyPI, private index'],
['.NET','NuGet','dotnet, nuget','nuget.org, GitHub Packages'],
['Anything','Generic packages','curl, CLI','GitLab and GitHub package registries']]},
{h:'Controlling where dependencies come from'},
{ul:['Point the build at an **internal proxy** that caches the public registry. Builds keep working during upstream outages and you can block unwanted packages.','Use a single configured **index** and avoid dependency confusion, where a public package with your private package\'s name is installed by mistake.','Scope private package names (for example `@acme/lib`) and require the internal source for them.','Publish with a pipeline identity, not from developers\' laptops.']},
{code:`# .npmrc: route the @acme scope to the internal registry
@acme:registry=https://npm.example.com/
//npm.example.com/:_authToken=\${NPM_TOKEN}`}],
src:[['GitHub Packages',K.GHD+'packages'],['GitLab package registry',K.GLD+'user/packages/package_registry/']]};

/* ---------- 6 ---------- */
L['devops:8:6']={blocks:[
{p:'An **artifact repository manager** (JFrog Artifactory, Sonatype Nexus) is one service that stores, proxies and serves many package formats: containers, Maven, npm, PyPI, NuGet and more.'},
{svg:K.dg(700,200,[
[10,10,680,180,'One manager, many formats',1],
[30,70,130,60,'CI builds',0],[220,40,200,40,'Local repo: your releases',0],[220,90,200,40,'Remote repo: proxy to public',0],[220,140,200,30,'Virtual repo: one URL',2],
[500,70,170,60,'Developers and|clusters pull',0]],
[[160,100,220,60],[160,100,220,110],[420,155,500,110]])},
{t:[['Repository type','Role'],
['**Local (hosted)**','Stores packages you publish'],
['**Remote (proxy)**','Caches an upstream registry; fetched once, served locally'],
['**Virtual (group)**','One URL that merges local and remote repositories']]},
{h:'What you gain'},
{ul:['**Speed and resilience**: cached dependencies survive upstream outages.','**Control**: block packages by licence or vulnerability, and keep an audit trail.','**Single source**: one place for permissions, retention and replication.']},
{h:'What it costs'},
{ul:['Another critical service to run, back up and secure.','Licensing for some features of commercial editions.']}],
src:[['JFrog Artifactory','https://jfrog.com/help/r/jfrog-artifactory-documentation'],['Sonatype Nexus Repository','https://help.sonatype.com/en/sonatype-nexus-repository.html']]};

/* ---------- 7 ---------- */
L['devops:8:7']={blocks:[
{p:'Artifacts accumulate. Without a retention policy, storage grows without limit and old vulnerable versions stay available. Combine **cleanup rules** with **promotion** between repositories.'},
{h:'Promotion repositories'},
{flow:['CI publishes to a snapshot or dev repository','Automated tests and scans pass','The same artifact is copied or retagged into a staging repository','Approval and verification','Copied into the release repository used by production']},
{t:[['Repository','Contents','Retention'],
['`dev` / snapshot','Every build','Short (days)'],
['`staging`','Release candidates','Medium (weeks)'],
['`release`','Versions that reached production','Long, per audit and rollback needs']]},
{h:'Cleanup rules'},
{ul:['Delete untagged and old snapshot images after a few days.','Keep the last N versions and every version deployed to production.','Never delete an artifact referenced by a running environment.','Run cleanup on a schedule with a dry-run report first.']},
{note:'Retention is also a security measure. An old image with a known vulnerability should not be pullable by mistake.'}]};

/* ---------- 8 ---------- */
L['devops:8:8']={blocks:[
{p:'Build the sample image in CI, tag it with the commit, scan it and push it only if the scan passes.'},
{flow:['Build the image with BuildKit and cache','Tag with version and commit SHA','Scan the image for vulnerabilities','Fail the job on high or critical findings','Push to the registry','Record the digest']},
{code:`name: image
on:
  push:
    branches: [main]
permissions:
  contents: read
  packages: write
jobs:
  image:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          load: true
          tags: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Scan
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: '1'
      - name: Push
        run: docker push ghcr.io/\${{ github.repository }}:\${{ github.sha }}`},
{h:'Verify'},
{ul:['Does an introduced vulnerable base image stop the push?','Is the pushed image tagged by commit?','What digest was produced, and where is it recorded?']}]};
})();
