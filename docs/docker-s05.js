/* LearnSphere - Docker, Section 05: Building Images with Dockerfiles & BuildKit.
   Lectures 0-9 are core, 10-17 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R,B=K.B;

/* ---------- diagrams ---------- */
const build=K.dg(700,170,[
[10,60,130,56,'Dockerfile|(the recipe)',2],[10,125,130,40,'Build context (files)',0],
[200,55,150,66,'BuildKit|runs each step,|uses the cache',2],[410,60,130,56,'Image|(layers + config)',2],[590,60,100,56,'Registry or|local engine',0]],
[[140,85,200,85],[140,145,200,105],[350,88,410,88],[540,88,590,88]]);

const cacheGood=K.dg(700,220,[
[10,10,680,100,'GOOD order: you edit app.py',1],[10,115,680,100,'BAD order (COPY . . first): same edit',1],
[25,45,120,50,'FROM python|cached',0],[160,45,120,50,'COPY requirements|cached',0],[295,45,120,50,'RUN pip install|cached',0],[430,45,120,50,'COPY . .|REBUILT',2],[565,45,120,50,'CMD|metadata',0],
[25,150,120,50,'FROM python|cached',0],[160,150,120,50,'COPY . .|REBUILT',2],[295,150,120,50,'RUN pip install|REBUILT (slow)',2],[430,150,120,50,'CMD|metadata',0]],
[[145,70,160,70],[280,70,295,70],[415,70,430,70],[550,70,565,70],[145,175,160,175],[280,175,295,175],[415,175,430,175]]);

const multi=K.dg(700,230,[
[10,10,360,210,'Stage 1: build (large, has compilers)',1],[400,10,290,210,'Stage 2: final image (small)',1],
[30,45,320,40,'FROM golang AS build',0],[30,95,320,40,'COPY source, go build -o app',0],[30,145,320,50,'Result: /out/app binary|(stage is then thrown away)',2],
[420,45,250,40,'FROM gcr.io/distroless/static',0],[420,95,250,40,'COPY --from=build /out/app /app',2],[420,145,250,50,'Ships only the binary|about 10 MB instead of 800 MB',2]],
[[350,165,420,115]]);

/* ---------- 0: Dockerfile basics ---------- */
L['docker:4:0']={blocks:[
{p:'A **Dockerfile** is a plain text file of instructions that describes how to build an image. It is the recipe: start from a base, add files, install software, set the command. Building from a file makes images **repeatable**, **reviewable** and easy to keep in version control.'},
{svg:build},
{h:'A first Dockerfile'},
{code:`# syntax=docker/dockerfile:1
FROM python:3.12-slim          # 1. start from a base image
WORKDIR /app                   # 2. set the working directory (created if missing)
COPY requirements.txt .        # 3. copy a file from the build context
RUN pip install --no-cache-dir -r requirements.txt   # 4. run a command during the build
COPY . .                       # 5. copy the rest of the app
CMD ["python", "app.py"]       # 6. the default command when a container starts`},
{code:`docker build -t myapp:1.0 .        # -t names the image, the dot is the build context
docker run --rm myapp:1.0`},
{h:'The core instructions'},
{t:[['Instruction','What it does','Makes a layer?'],
['`FROM`','Chooses the base image. Must be first (after comments and ARG)','Starts the image'],
['`RUN`','Executes a command at **build time** and saves the result','Yes'],
['`COPY`','Copies files from the build context into the image','Yes'],
['`ADD`','Like COPY, with extras (see below)','Yes'],
['`WORKDIR`','Sets the directory for the following instructions and the container','Metadata (creates the folder)'],
['`CMD`','Default command at **run time**','No (metadata)']]},
{h:'FROM'},
{code:`FROM ubuntu:24.04                  # a specific tag (good)
FROM python:3.12-slim AS base      # name this stage (used in multi-stage builds)
FROM scratch                       # an empty image (for static binaries)
FROM --platform=linux/amd64 node:22   # force a platform`},
{ul:['Always choose a **tag** (never rely on `latest`).','The base decides size and security: `slim`, `alpine` and distroless are smaller than full images.']},
{h:'RUN: shell form and exec form'},
{code:`RUN apt-get update && apt-get install -y --no-install-recommends curl   # shell form: /bin/sh -c "..."
RUN ["/bin/bash", "-c", "echo hello"]                                   # exec form: no shell`},
{p:'Use shell form for ordinary commands. Chain related commands with `&&` so that they share **one layer**.'},
{h:'COPY versus ADD'},
{t:[['','COPY','ADD'],
['Copies local files and folders','Yes','Yes'],
['Unpacks local `.tar` archives automatically','No','**Yes**'],
['Downloads from a URL','No','Yes (but not recommended)'],
['Can copy from another build stage (`--from`)','Yes','No'],
['Behaviour is obvious','**Yes**','Surprises possible']]},
{note:'Rule: **use COPY**. Use ADD only when you need the automatic tar extraction. For downloads prefer `RUN curl ... | tar ...` or `ADD --checksum=` so you can verify what you fetch.'},
{code:`COPY app.py .                         # file to the working directory
COPY src/ /app/src/                   # folder
COPY --chown=1000:1000 . /app         # set ownership while copying
COPY --chmod=755 entrypoint.sh /usr/local/bin/
ADD rootfs.tar.gz /                   # extracts into /`},
{h:'WORKDIR'},
{code:`WORKDIR /app
COPY . .                  # copies into /app
RUN pwd                   # /app
WORKDIR sub               # relative: /app/sub`},
{ul:['Prefer `WORKDIR` over `RUN cd /somewhere && ...`; a `cd` lasts only for that one RUN.','It creates the directory if needed.']},
{h:'Build, run, look'},
{code:`docker build -t myapp:1.0 .
docker image ls myapp
docker history myapp:1.0          # one row per instruction
docker run --rm -it myapp:1.0 sh  # explore (if the image has a shell)`},
{h:'Common beginner errors'},
{t:[['Error','Cause'],
['`COPY failed: file not found in build context`','The file is outside the context folder or excluded by .dockerignore'],
['`failed to solve: ... not found`','The base image name or tag is wrong'],
['A change does not appear','You forgot to rebuild, or you ran an old tag']]}],
src:[['Dockerfile reference',K.D+'reference/dockerfile/'],['docker build',R+'cli/docker/buildx/build/']]};

/* ---------- 1: Remaining Dockerfile instructions ---------- */
L['docker:4:1']={blocks:[
{p:'Besides FROM, RUN, COPY, ADD, WORKDIR and CMD, a handful of other instructions control **metadata** and **runtime behaviour**. This lecture is the reference you will come back to.'},
{t:[['Instruction','Purpose','Layer?'],
['`LABEL`','Attach key-value metadata','No'],
['`EXPOSE`','Document which port the app listens on','No'],
['`ENV`','Set an environment variable (build and run)','No'],
['`USER`','Run later steps and the container as this user','No'],
['`VOLUME`','Declare a mount point for external data','No'],
['`STOPSIGNAL`','Choose the signal that `docker stop` sends','No'],
['`SHELL`','Change the default shell for shell-form commands','No'],
['`HEALTHCHECK`','Define a health check','No'],
['`ONBUILD`','Register a trigger for images built **from** this one','No']]},
{h:'LABEL'},
{code:`LABEL org.opencontainers.image.title="Shop API" \\
      org.opencontainers.image.version="1.4.2" \\
      org.opencontainers.image.source="https://github.com/acme/shop" \\
      maintainer="team@acme.example"`},
{p:'Labels help humans and tools: version, source repository, license. Query them with `docker inspect --format "{{json .Config.Labels}}" IMAGE` and filter with `docker ps --filter label=...`. The standard keys start with `org.opencontainers.image.`.'},
{h:'EXPOSE'},
{code:`EXPOSE 8080
EXPOSE 53/udp`},
{note:'EXPOSE is **documentation only**. It does not open or publish anything. You still need `-p 8080:8080` at run time. `docker run -P` publishes all EXPOSEd ports to random host ports.'},
{h:'USER'},
{code:`RUN groupadd -r app && useradd -r -g app -m app    # create the user first (Debian)
# Alpine: RUN addgroup -S app && adduser -S -G app app
USER app                      # all later RUN, CMD and ENTRYPOINT run as app
# Numeric IDs are clearer for Kubernetes and security tools:
USER 10001:10001`},
{p:'Running as **non-root** is one of the most important hardening steps (Section 9). Put `USER` after the steps that need root (installing packages).'},
{h:'VOLUME'},
{code:`VOLUME /var/lib/postgresql/data`},
{ul:['It tells Docker that this path holds data that should live **outside** the container layer. A container started from the image gets an anonymous volume there.','Changes made to that folder **after** the VOLUME instruction during the build are discarded, so create files before declaring it.','Most teams mount volumes explicitly at run time and skip VOLUME in their own images.']},
{h:'STOPSIGNAL'},
{code:`STOPSIGNAL SIGQUIT       # nginx shuts down gracefully on SIGQUIT
# docker stop now sends SIGQUIT instead of SIGTERM`},
{h:'SHELL'},
{code:`SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN curl -fsSL https://example.com/x | tar -xz        # a failing curl now fails the build`},
{p:'The default shell form is `/bin/sh -c`. Changing it to bash with `pipefail` makes pipelines fail correctly.'},
{h:'ONBUILD'},
{code:`# in a base image
ONBUILD COPY . /app
ONBUILD RUN make
# These run later, when ANOTHER Dockerfile does FROM this image`},
{p:'ONBUILD is rarely a good idea: it hides behaviour in a parent image. Know it for the exam; avoid it in your own images.'},
{h:'ENV'},
{code:`ENV APP_ENV=production PORT=8080
# available during later build steps AND in the running container`},
{h:'A complete example'},
{code:`FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/acme/web"
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "server.js"]`}],
src:[['Dockerfile reference',K.D+'reference/dockerfile/'],['OCI image annotations','https://github.com/opencontainers/image-spec/blob/main/annotations.md']]};

/* ---------- 2: Build context and .dockerignore ---------- */
L['docker:4:2']={blocks:[
{p:'When you run `docker build .`, the final dot is the **build context**: the folder whose files the builder is allowed to use. `COPY` and `ADD` can only reach files inside it. Understanding the context prevents slow builds and accidental leaks.'},
{svg:K.dg(700,200,[
[10,20,300,170,'Build context (the folder you pass)',1],
[25,50,130,30,'Dockerfile',2],[25,90,130,30,'app.py',0],[25,130,130,30,'requirements.txt',0],[170,50,125,30,'node_modules/',0],[170,90,125,30,'.git/',0],[170,130,125,30,'.env (secrets)',0],
[400,40,280,60,'.dockerignore|removes unwanted files BEFORE sending',2],[400,125,280,50,'Builder receives only|what is left',0]],
[[310,70,400,70],[540,100,540,125]])},
{h:'Why the context matters'},
{ul:['**Speed:** the whole context is sent to the builder first. A 2 GB `node_modules` or `.git` folder makes every build slow.','**Cache:** `COPY . .` includes every file; any changed file invalidates the cache from that step.','**Security:** `.env` files, SSH keys and credentials in the context can be copied into an image layer by accident.']},
{h:'Choosing a context and Dockerfile'},
{code:`docker build .                                  # context = current folder, file = ./Dockerfile
docker build -f docker/Dockerfile.prod .         # a different Dockerfile, same context
docker build -t app ./services/api                # context = that subfolder
docker build https://github.com/acme/app.git#main   # context from a Git repository
docker build - < Dockerfile                       # Dockerfile from stdin (no context files)`},
{note:'`COPY ../secrets .` does not work: you cannot copy files from outside the context. Choose the context folder to include everything the build needs.'},
{h:'.dockerignore'},
{p:'A file named `.dockerignore` in the context root lists what to **exclude**. Syntax is similar to `.gitignore`.'},
{code:`# .dockerignore
.git
.gitignore
node_modules
**/*.log
*.md
!README.md          # exception: keep this one
.env
.env.*
Dockerfile
docker-compose*.yml
dist/
**/__pycache__`},
{t:[['Pattern','Meaning'],
['`node_modules`','That folder in the context root'],
['`**/node_modules`','That folder at any depth'],
['`*.log`','Files ending in .log in the root'],
['`**/*.log`','Log files at any depth'],
['`!keep.txt`','Re-include a file that an earlier rule excluded'],
['`#`','Comment']]},
{ul:['Rules are matched against paths relative to the context root.','Later rules override earlier ones, so put `!` exceptions after the exclusions.','A per-Dockerfile ignore file also works: `Dockerfile.prod.dockerignore`.']},
{h:'See the effect'},
{code:`docker build --progress=plain -t app .
# #3 [internal] load build context
# #3 transferring context: 1.2kB              <- small and fast with a good .dockerignore
# Without it you might see: transferring context: 480MB`},
{h:'Checklist for a good .dockerignore'},
{flow:['Exclude version control: .git','Exclude dependency folders that the image builds itself: node_modules, venv','Exclude build output and logs','Exclude secrets and local config: .env, *.pem, id_rsa','Exclude files the image does not need: docs, tests, CI files']},
{h:'Troubleshooting'},
{t:[['Symptom','Likely cause'],
['`COPY failed: file not found`','File is outside the context or listed in .dockerignore'],
['Build is slow before step 1','Huge context; check `transferring context`'],
['A change is not picked up','The file is excluded by .dockerignore']]}],
src:[['Build context',B+'concepts/context/'],['.dockerignore',B+'concepts/context/#dockerignore-files']]};

/* ---------- 3: CMD vs ENTRYPOINT, shell vs exec form ---------- */
L['docker:4:3']={blocks:[
{p:'Two instructions define **what runs when a container starts**: `ENTRYPOINT` and `CMD`. Each can be written in two forms. Getting these right affects flexibility, signals and clean shutdown.'},
{h:'Roles'},
{t:[['','ENTRYPOINT','CMD'],
['Purpose','The program the container runs','Default arguments, or a default command'],
['Override at run time','`--entrypoint` flag','Anything after the image name'],
['Think of it as','The fixed part','The changeable part'],
['Multiple allowed?','Only the last counts','Only the last counts']]},
{h:'Two forms'},
{t:[['','Exec form (recommended)','Shell form'],
['Syntax','`CMD ["nginx", "-g", "daemon off;"]`','`CMD nginx -g "daemon off;"`'],
['Runs as','The program directly (it is PID 1)','`/bin/sh -c "..."` (the shell is PID 1)'],
['Variable expansion','No (use `["sh","-c","echo $HOME"]`)','Yes'],
['Receives SIGTERM from `docker stop`','**Yes**','No: the shell does not forward it, so shutdown waits 10 s then kills'],
['Use for','Almost everything','Quick scripts, when you need shell features']]},
{note:'Exec form must be a JSON array with **double quotes**. Single quotes make Docker treat it as shell form text and fail.'},
{h:'How ENTRYPOINT and CMD combine'},
{t:[['ENTRYPOINT','CMD','Command that runs'],
['(none)','(none)','Error: nothing to run (base image default if any)'],
['(none)','`["python","app.py"]`','`python app.py`'],
['`["python"]`','(none)','`python`'],
['`["python"]`','`["app.py"]`','`python app.py`'],
['`["python"]`','`["app.py"]` and you run `... img other.py`','`python other.py`'],
['`["python"]` and you run `--entrypoint sh img`','`["app.py"]`','`sh` (CMD is ignored when the ENTRYPOINT is overridden)']]},
{h:'Patterns'},
{p:'**Pattern 1: CMD only.** A flexible image where users can run anything.'},
{code:`FROM python:3.12-slim
CMD ["python", "app.py"]
# docker run img            -> python app.py
# docker run img bash       -> bash`},
{p:'**Pattern 2: ENTRYPOINT as the program, CMD as default arguments.** The image behaves like a tool.'},
{code:`FROM alpine
ENTRYPOINT ["ping"]
CMD ["-c", "3", "localhost"]
# docker run img                    -> ping -c 3 localhost
# docker run img -c 1 example.com   -> ping -c 1 example.com`},
{p:'**Pattern 3: ENTRYPOINT script for setup, then run the main process with `exec`.**'},
{code:`#!/bin/sh
# docker-entrypoint.sh
set -e
echo "preparing config..."
exec "$@"        # replace the shell with the real command so it becomes PID 1 and gets signals

# Dockerfile
COPY docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]`},
{h:'Why PID 1 and signals matter'},
{flow:['docker stop sends SIGTERM to PID 1','Exec form: your program is PID 1, receives it and shuts down cleanly','Shell form: /bin/sh is PID 1 and does not pass the signal on','Docker waits 10 seconds, then sends SIGKILL and drops in-flight work']},
{code:`docker inspect -f 'entrypoint={{.Config.Entrypoint}} cmd={{.Config.Cmd}}' myimage
docker top mycontainer          # PID 1 should be your program, not "sh -c ..."`},
{h:'Rules of thumb'},
{ul:['Prefer **exec form** for both.','Use `CMD` for the default command; add `ENTRYPOINT` when the image is a tool or needs a startup script.','If a script is the entrypoint, end it with `exec "$@"`.','Only one ENTRYPOINT and one CMD take effect: the last of each.']}],
src:[['CMD',K.D+'reference/dockerfile/#cmd'],['ENTRYPOINT',K.D+'reference/dockerfile/#entrypoint'],['How CMD and ENTRYPOINT interact',K.D+'reference/dockerfile/#understand-how-cmd-and-entrypoint-interact']]};

/* ---------- 4: ARG vs ENV ---------- */
L['docker:4:4']={blocks:[
{p:'Both `ARG` and `ENV` hold values, but they live in different places. The difference is **when** the value exists.'},
{t:[['','ARG','ENV'],
['Available during the build','Yes','Yes (after it is set)'],
['Available in the running container','**No**','**Yes**'],
['Set from outside','`docker build --build-arg NAME=value`','`docker run -e NAME=value` (overrides the default)'],
['Saved in the image history','Visible in `docker history`','Stored in image config, visible in `docker inspect`'],
['Typical use','Versions, build options, base image choice','Runtime configuration (port, mode)']]},
{svg:K.dg(700,170,[
[10,60,170,56,'Build time|ARG exists here',2],[260,60,170,56,'Image|only ENV is stored',0],[510,60,180,56,'Run time|ENV exists here',2]],
[[180,88,260,88],[430,88,510,88]])},
{h:'ARG'},
{code:`ARG PYTHON_VERSION=3.12
FROM python:$PYTHON_VERSION-slim            # ARG before FROM can pick the base image

ARG APP_VERSION=dev                        # must be declared again after FROM to use inside the stage
RUN echo "building $APP_VERSION"

# docker build --build-arg APP_VERSION=1.4.2 -t app:1.4.2 .
# docker build --build-arg PYTHON_VERSION=3.11 -t app:py311 .`},
{ul:['An ARG declared before `FROM` is only usable in `FROM` lines. Declare it again after FROM to use it in the stage.','Without a default, an ARG that is not passed is empty.','`docker build` warns if you pass `--build-arg` for an ARG that is not declared.']},
{h:'ENV'},
{code:`ENV APP_ENV=production \\
    PORT=8080
CMD ["sh", "-c", "echo running in $APP_ENV on $PORT"]

# docker run --rm app                     -> running in production on 8080
# docker run --rm -e APP_ENV=staging app  -> running in staging on 8080`},
{h:'Turning a build argument into a runtime value'},
{code:`ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION        # now the container also knows its version`},
{h:'Scope across stages'},
{note:'Each stage of a multi-stage build starts clean. An ARG or ENV set in one stage is **not** visible in another. Declare it where you use it.'},
{h:'Predefined build arguments'},
{t:[['ARG','Meaning'],
['`TARGETPLATFORM`, `TARGETOS`, `TARGETARCH`','Platform being built for (set by buildx)'],
['`BUILDPLATFORM`','Platform of the builder'],
['`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`','Proxy settings available without declaring them']]},
{h:'Security: do not put secrets in ARG or ENV'},
{p:'Build arguments appear in `docker history`, and ENV values are stored in the image config. Anyone who can pull the image can read them.'},
{code:`# BAD
ARG NPM_TOKEN=abc123
RUN npm config set //registry.npmjs.org/:_authToken=$NPM_TOKEN

docker history --no-trunc app | grep NPM_TOKEN     # the token is visible!`},
{p:'Use **build secrets** (a later lecture in this section) instead.'},
{h:'Decision guide'},
{flow:['Value needed only to build the image (version, flag)? Use ARG.','Value the running app reads (port, mode)? Use ENV.','Needed in both? ARG then ENV=$ARG.','A password or token? Neither: use a secret mount or runtime secrets.']}],
src:[['ARG',K.D+'reference/dockerfile/#arg'],['ENV',K.D+'reference/dockerfile/#env'],['Build variables',B+'building/variables/']]};

/* ---------- 5: Layers, caching, best practices ---------- */
L['docker:4:5']={blocks:[
{p:'Docker builds an image one instruction at a time. After each step it saves the result as a **layer** and remembers it in a **cache**. On the next build, if a step and everything before it are unchanged, Docker reuses the saved layer instead of running the step again. Order your Dockerfile well and rebuilds take seconds instead of minutes.'},
{h:'When is the cache used?'},
{ul:['**RUN:** reused if the base layer and the command text are identical. (It does not know whether the web changed; `apt-get update` text is the same, so it stays cached.)','**COPY / ADD:** reused if the **content (checksum)** of the copied files is identical.','**Once one step is invalidated, every later step runs again.** The cache is a chain.']},
{svg:cacheGood},
{h:'Rule 1: put things that change rarely first'},
{code:`# BAD: any code change reinstalls all dependencies
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt

# GOOD: dependencies are cached until requirements.txt changes
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .`},
{h:'Rule 2: combine commands that belong together'},
{code:`# BAD: update is cached separately; later installs use stale package lists
RUN apt-get update
RUN apt-get install -y curl

# GOOD: one layer, and clean up in the SAME layer
RUN apt-get update \\
 && apt-get install -y --no-install-recommends curl \\
 && rm -rf /var/lib/apt/lists/*`},
{note:'Deleting files in a **later** layer does not shrink the image. The earlier layer still contains them. Clean up in the same RUN that created them.'},
{h:'Best practices checklist'},
{t:[['Practice','Why'],
['Choose a small, specific base (`python:3.12-slim`, alpine, distroless)','Less to download, fewer vulnerabilities'],
['Pin base image versions (and digests for critical builds)','Reproducible builds'],
['Use a `.dockerignore`','Smaller context, better cache'],
['Order from least to most frequently changing','Cache hits'],
['Use multi-stage builds','Leave build tools out of the final image'],
['`--no-install-recommends`, `--no-cache-dir`, clean package lists','Smaller layers'],
['Run as a non-root `USER`','Security'],
['One main process per container','Simpler scaling and logging'],
['Use COPY, not ADD','Predictable behaviour'],
['Use exec-form CMD/ENTRYPOINT','Correct signal handling'],
['No secrets in the image','Layers are readable by anyone with the image'],
['Add `LABEL`s and a `HEALTHCHECK`','Operability']]},
{h:'Cache control flags'},
{code:`docker build --no-cache -t app .          # ignore the cache completely
docker build --pull -t app .              # always check for a newer base image
docker build --progress=plain -t app .    # show every step and "CACHED" markers
docker builder prune                      # delete build cache (frees disk)`},
{h:'Cache mounts (BuildKit): reuse downloads between builds'},
{code:`RUN --mount=type=cache,target=/root/.cache/pip \\
    pip install -r requirements.txt
# the pip download cache persists on the builder but is NOT stored in the image`},
{h:'Measure'},
{code:`docker image ls app              # size
docker history app               # which step is large
docker build --progress=plain . 2>&1 | grep -c CACHED`}],
src:[['Build cache',B+'cache/'],['Dockerfile best practices',B+'building/best-practices/']]};

/* ---------- 6: Multi-stage builds ---------- */
L['docker:4:6']={blocks:[
{p:'Compilers, package managers and test tools are needed to **build** an application but not to **run** it. A **multi-stage build** uses several `FROM` lines in one Dockerfile. Earlier stages do the heavy work; the last stage copies only the results. The final image stays small and has less to attack.'},
{svg:multi},
{h:'Example: a Go program'},
{code:`# syntax=docker/dockerfile:1
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/app .

FROM gcr.io/distroless/static-debian12
COPY --from=build /out/app /app
USER nonroot
ENTRYPOINT ["/app"]`},
{code:`docker build -t goapp .
docker image ls goapp          # about 10 MB; the golang build image is about 800 MB`},
{h:'Example: Node.js build, nginx to serve'},
{code:`FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build               # produces /app/dist

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html`},
{h:'The pieces'},
{t:[['Syntax','Meaning'],
['`FROM image AS name`','Starts a named stage'],
['`COPY --from=name /path /dest`','Copy files out of an earlier stage (or from any image: `--from=nginx`)'],
['`docker build --target name .`','Build only up to that stage'],
['Last `FROM`','The stage that becomes the final image']]},
{h:'Useful stage patterns'},
{code:`FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS test
COPY . .
RUN pytest

FROM base AS final
COPY app/ ./app/
USER 10001
CMD ["python", "-m", "app"]

# docker build --target test .      # run the tests only
# docker build -t app .             # build the final image`},
{ul:['**Test stage:** run tests during the build; if they fail, the build fails.','**Debug stage:** a stage with extra tools you can target with `--target debug`.','Stages that are not needed for the target are **skipped** by BuildKit and may build in parallel.']},
{h:'Results to expect'},
{t:[['Approach','Typical size'],
['Single stage with Go toolchain','800 MB or more'],
['Multi-stage to alpine','20 to 30 MB'],
['Multi-stage to distroless or scratch','5 to 15 MB']]},
{p:'Numbers depend on your program. Always measure with `docker image ls`.'},
{h:'Pitfalls'},
{ul:['The final stage needs everything at run time: shared libraries, CA certificates and a timezone database for static binaries on `scratch`.','`distroless` and `scratch` have no shell, so `docker exec ... sh` will not work. Plan how to debug (Section 11).','ARG/ENV do not carry across stages.']},
{flow:['Pick a build stage with all tools','Compile or bundle the app into a known folder','Start a clean final stage from a minimal base','COPY --from only the artifacts','Set USER, ENTRYPOINT and metadata']}],
src:[['Multi-stage builds',B+'building/multi-stage/'],['Distroless images','https://github.com/GoogleContainerTools/distroless']]};

/* ---------- 7: BuildKit, buildx ---------- */
L['docker:4:7']={blocks:[
{p:'**BuildKit** is the modern build engine behind `docker build`. It builds independent steps in parallel, caches smartly, skips unused stages, and offers features such as secret mounts. **buildx** is the CLI plugin that gives you full control of BuildKit (`docker buildx ...`). On current Docker versions BuildKit is the **default builder**, so you already use it.'},
{t:[['Benefit','Meaning'],
['Parallelism','Independent stages and steps run at the same time'],
['Better cache','Fine-grained, shareable, can be exported to a registry'],
['Skips unused work','Stages not needed for the target are not built'],
['Mounts','`--mount=type=cache|secret|ssh|bind` in RUN'],
['Multiple outputs','Load to Docker, push to a registry, write to a folder or tar'],
['Multi-platform','Build for several CPU types with one command']]},
{h:'Builders and drivers'},
{p:'A **builder** is an instance of BuildKit that runs your builds. Each uses a **driver**.'},
{t:[['Driver','Where BuildKit runs','Notes'],
['`docker`','Inside the Docker daemon','Default; fewest features without the containerd image store'],
['`docker-container`','In its own container','Full features: multi-platform, cache export, attestations'],
['`kubernetes`','Pods in a cluster','Shared scalable builders'],
['`remote`','A BuildKit daemon you connect to','Dedicated build servers']]},
{code:`docker buildx ls                                   # list builders; * marks the default
docker buildx create --name mybuilder --driver docker-container --use
docker buildx inspect --bootstrap                  # start it and show details
docker buildx use default                          # go back to the default builder
docker buildx rm mybuilder`},
{h:'Building with buildx'},
{code:`docker buildx build -t myapp:1.0 .                         # same as docker build
docker buildx build --progress=plain -t myapp:1.0 .        # full log of every step
docker buildx build --target test .                        # build one stage
docker buildx build -t myapp:1.0 --load .                  # load into local images (docker-container driver)
docker buildx build -t reg.example.com/myapp:1.0 --push .  # build and push in one step
docker buildx build -o type=local,dest=./out .             # write the final files to a folder
docker buildx build --platform linux/amd64,linux/arm64 -t reg/myapp:1.0 --push .`},
{note:'With the `docker-container` driver the image stays in the builder cache unless you add `--load` (to local Docker) or `--push`. A common surprise: "my image built but docker image ls shows nothing".'},
{h:'Output options'},
{t:[['Flag','Result'],
['`--load`','Image appears in `docker image ls`'],
['`--push`','Image goes to the registry'],
['`-o type=local,dest=DIR`','Final file system is written to DIR'],
['`-o type=tar,dest=FILE`','Final file system as a tar'],
['`-o type=oci,dest=FILE`','OCI layout tar']]},
{h:'Build checks: lint your Dockerfile'},
{p:'Build checks analyse a Dockerfile and warn about mistakes and bad practice **without building**.'},
{code:`docker build --check .                # run the checks only
docker buildx build --check .`},
{code:`# Example warnings you may see (names differ by version)
#   JSONArgsRecommended: JSON arguments recommended for CMD to prevent unintended behavior related to OS signals
#   FromAsCasing: 'as' and 'FROM' keywords' casing do not match
#   UndefinedVar: Usage of undefined variable '$NAME'`},
{code:`# syntax=docker/dockerfile:1
# check=error=true         # make any check warning fail the build (good for CI)
FROM alpine
CMD echo hello              # shell form: the check will complain`},
{h:'The syntax directive'},
{p:'The first line `# syntax=docker/dockerfile:1` selects the Dockerfile frontend, so you get current features even when the Docker version is older. It is recommended on every Dockerfile.'},
{h:'Useful environment settings'},
{ul:['`BUILDKIT_PROGRESS=plain` for plain log output in CI.','`docker builder prune` to clear the build cache; `docker buildx du` to see cache usage.','Pin the builder in CI so every run behaves the same.']}],
src:[['BuildKit',B+'buildkit/'],['Builders',B+'builders/'],['Build checks',B+'checks/'],['docker buildx build',R+'cli/docker/buildx/build/']]};

/* ---------- 8: Build secrets and SSH mounts ---------- */
L['docker:4:8']={blocks:[
{p:'Builds sometimes need a **secret**: a private package registry token, a deploy key, a license file. If you pass it through `ARG`, `ENV` or `COPY`, it ends up **inside an image layer** and anyone with the image can read it. BuildKit provides mounts that make the secret available to **one step only** and never save it.'},
{h:'The wrong ways (and why)'},
{t:[['Method','Problem'],
['`ARG TOKEN` / `--build-arg`','Shown in `docker history` and stored in metadata'],
['`ENV TOKEN=...`','Stored in image config forever'],
['`COPY .npmrc .` then delete it','The file stays in the earlier layer'],
['Credentials in the Git URL of a `RUN git clone`','Visible in history']]},
{h:'Secret mounts'},
{flow:['At build time you pass the secret from a file or environment variable','BuildKit mounts it as a temporary file only during that RUN','The step uses it (for example to authenticate)','The mount disappears; nothing is written to any layer']},
{code:`# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \\
    npm ci
COPY . .`},
{code:`# Pass the secret from a file
docker build --secret id=npmrc,src=$HOME/.npmrc -t app .

# Or from an environment variable
export NPM_TOKEN=abc123
docker build --secret id=npm_token,env=NPM_TOKEN -t app .
# in the Dockerfile:  RUN --mount=type=secret,id=npm_token \\
#                       NPM_TOKEN=$(cat /run/secrets/npm_token) npm ci`},
{ul:['By default a secret is mounted at `/run/secrets/<id>`; use `target=` to choose another path.','The secret is available only in that RUN instruction.','The id is just a label that connects the flag to the mount.']},
{h:'Prove it did not leak'},
{code:`docker history --no-trunc app | grep -i npm      # no token text
docker run --rm app ls /root/.npmrc               # No such file`},
{h:'SSH mounts: use your SSH agent for private Git repositories'},
{code:`# syntax=docker/dockerfile:1
FROM alpine
RUN apk add --no-cache git openssh-client
RUN mkdir -p -m 0700 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts
RUN --mount=type=ssh git clone git@github.com:acme/private-lib.git /lib`},
{code:`eval $(ssh-agent) && ssh-add ~/.ssh/id_ed25519
docker build --ssh default -t app .`},
{p:'The private key never enters the build; BuildKit forwards only the **agent socket** for that step.'},
{h:'Other mount types'},
{t:[['Mount','Use'],
['`type=secret`','Credentials and config files'],
['`type=ssh`','Forward an SSH agent'],
['`type=cache`','Persistent package caches between builds'],
['`type=bind`','Read files from the context or another stage without copying them into a layer']]},
{note:'Even the final image can leak secrets if you copy them in a later `COPY`, so keep secrets out of the **runtime** image completely. For run-time secrets use Compose/Swarm secrets (Sections 8 and 10) or an external vault.'},
{h:'Checklist'},
{ul:['Never hard-code tokens in a Dockerfile or commit them to Git.','Use `--secret` (not `--build-arg`) for credentials.','Check `docker history --no-trunc` and scan images for secrets in CI.','Use short-lived tokens for CI builds.']}],
src:[['Build secrets',B+'building/secrets/'],['RUN --mount',K.D+'reference/dockerfile/#run---mount']]};

/* ---------- 9: Practical ---------- */
L['docker:4:9']={blocks:[
{p:'**Goal:** containerize a small Python web app, then improve the image step by step and measure each change. You will practise the Dockerfile, the cache, `.dockerignore`, multi-stage builds and non-root users.'},
{flow:['Create the app and a naive Dockerfile (version 1)','Build and measure size and rebuild time','Fix cache order and add .dockerignore (version 2)','Switch to a slim base, multi-stage and a non-root user (version 3)','Lint with build checks, run and compare']},
{h:'Step 0: the app'},
{code:`mkdir lab-app && cd lab-app
cat > app.py <<'EOF'
from flask import Flask
app = Flask(__name__)

@app.get("/")
def home():
    return "Hello from a container!\\n"

@app.get("/health")
def health():
    return "ok\\n"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
EOF
echo "flask==3.0.3" > requirements.txt
printf "venv\\n__pycache__\\n.git\\n.env\\n*.md\\n" > .dockerignore`},
{h:'Version 1: naive'},
{code:`cat > Dockerfile.v1 <<'EOF'
FROM python:3.12
COPY . /app
WORKDIR /app
RUN pip install -r requirements.txt
CMD python app.py
EOF
docker build -f Dockerfile.v1 -t lab:v1 .
docker image ls lab:v1                    # note the SIZE (about 1 GB)
echo "# change" >> app.py
time docker build -f Dockerfile.v1 -t lab:v1 .   # pip reinstalls everything: slow`},
{h:'Version 2: cache order and slim base'},
{code:`cat > Dockerfile.v2 <<'EOF'
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "app.py"]
EOF
docker build -f Dockerfile.v2 -t lab:v2 .
docker image ls lab                        # v2 is much smaller
echo "# change 2" >> app.py
time docker build -f Dockerfile.v2 -t lab:v2 .   # pip step shows CACHED: fast`},
{h:'Version 3: multi-stage, non-root, health check'},
{code:`cat > Dockerfile.v3 <<'EOF'
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=build /install /usr/local
COPY app.py .
RUN useradd -r -u 10001 app
USER 10001
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1
CMD ["python", "app.py"]
EOF
docker build --check -f Dockerfile.v3 .        # lint
docker build -f Dockerfile.v3 -t lab:v3 .
docker image ls lab`},
{h:'Run and test'},
{code:`docker run -d --name lab -p 5000:5000 lab:v3
curl http://localhost:5000/            # Hello from a container!
docker ps --filter name=lab            # STATUS becomes (healthy)
docker exec lab id                     # uid=10001 (not root)
docker history lab:v3 | head`},
{h:'Fill in your results'},
{t:[['Version','Base','Cache order','Non-root','Size (yours)','Rebuild after code change'],
['v1','python:3.12','bad','no','~1 GB','slow (reinstalls)'],
['v2','python:3.12-slim','good','no','~150 MB','fast'],
['v3','slim + multi-stage','good','yes','~150 MB or less','fast']]},
{note:'Your numbers will differ by Docker and Python version. What matters is the relative improvement and understanding **why** each change helped.'},
{h:'Cleanup'},
{code:`docker rm -f lab
docker image rm lab:v1 lab:v2 lab:v3
cd .. && rm -rf lab-app`},
{h:'Stretch goals'},
{ul:['Add a test stage that runs a tiny test with `--target test`.','Switch to a distroless Python base and see what breaks (no shell).','Pass `--build-arg APP_VERSION=1.0` and show it in the app with ENV.','Push the final image to the registry from the previous practical and pull it by digest.']}],
src:[['Dockerfile best practices',B+'building/best-practices/'],['Multi-stage builds',B+'building/multi-stage/'],['Python guide',K.D+'guides/python/']]};
})();
