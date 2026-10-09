/* LearnSphere - Docker, Section 04: Images & Registries.
   Lectures 0-8 are core, 9-13 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;

/* ---------- diagrams ---------- */
const anatomy=K.dg(700,270,[
[10,100,150,66,'Image index|(optional, one entry|per platform)',0],
[200,100,140,66,'Manifest|(lists config + layers)|sha256:ab12...',2],
[400,20,170,50,'Config (JSON)|env, cmd, history',0],
[400,95,170,44,'Layer 1: base files',0],[400,147,170,44,'Layer 2: packages',0],[400,199,170,44,'Layer 3: app code',0],
[600,95,90,150,'Each is|stored by|its sha256|digest',0]],
[[160,133,200,133],[340,115,400,48],[340,125,400,117],[340,140,400,169],[340,152,400,221]]);

const regflow=K.dg(700,190,[
[10,70,120,56,'Local image|myapp:latest',0],[170,70,130,56,'docker tag|adds a name that|points to a registry',2],
[340,70,120,56,'docker push|uploads layers',2],[500,40,190,110,'Registry|registry.example.com|myteam/myapp:1.0',1],
[500,150,190,34,'pull from any host',0]],
[[130,98,170,98],[300,98,340,98],[460,98,500,98]]);

const stores=K.dg(700,230,[
[10,10,330,210,'Classic image store',1],[360,10,330,210,'containerd image store',1],
[30,45,290,40,'dockerd keeps its own image database',0],[30,95,290,40,'Layers in graph driver (overlay2)',0],[30,145,290,50,'Images and layers live under|/var/lib/docker/image + overlay2',0],
[380,45,290,40,'containerd owns images and snapshots',2],[380,95,290,40,'Content store + snapshotter (overlayfs)',2],[380,145,290,50,'Supports multi-platform images,|attestations and lazy pulling',2]],
[]);

/* ---------- 0: Image anatomy ---------- */
L['docker:3:0']={blocks:[
{p:'An **image** is a read-only template used to create containers. Inside, it is not one big file: it is a set of **layers** plus a small **configuration**, described by a **manifest**. Understanding this explains caching, sharing, and why a pull downloads only some parts.'},
{svg:anatomy},
{t:[['Part','What it is','Why it matters'],
['**Layer**','A compressed archive of file changes (added, changed, deleted files)','Shared between images; downloaded once'],
['**Config**','JSON with environment, default command, user, exposed ports, labels and history','Controls how containers start from this image'],
['**Manifest**','JSON listing the config and the layers by digest','The "table of contents" of one image for one platform'],
['**Image index**','A list of manifests, one per platform (amd64, arm64)','Lets one tag work on many CPU types'],
['**Digest**','A sha256 hash of the content, written `sha256:...`','A fingerprint that cannot be forged or changed']]},
{h:'Content addressing: names come from content'},
{p:'Each layer and each manifest is stored under the **hash of its bytes**. Two consequences:'},
{ul:['**Integrity:** if one byte changes, the digest changes. A pulled image can always be verified.','**Sharing:** if two images contain an identical layer, it has the same digest and is stored once on disk and downloaded once.']},
{svg:K.dg(700,180,[
[10,20,200,60,'python:3.12-slim|(app A uses it)',0],[10,100,200,60,'python:3.12-slim|(app B uses it)',0],
[290,55,190,70,'Shared base layers|stored ONCE',2],[560,20,130,60,'App A layer',0],[560,100,130,60,'App B layer',0]],
[[210,50,290,80],[210,130,290,100],[480,80,560,50],[480,100,560,130]])},
{h:'Look at an image'},
{code:`docker pull python:3.12-slim

docker image inspect python:3.12-slim              # config, layers, digests
docker image inspect -f '{{.Id}}' python:3.12-slim
docker image inspect -f '{{json .RootFS.Layers}}' python:3.12-slim
docker image inspect -f '{{.Config.Cmd}} {{.Config.Env}}' python:3.12-slim
docker history python:3.12-slim                    # one row per layer with size and instruction

# Digest and the registry view (platforms)
docker image ls --digests python
docker buildx imagetools inspect python:3.12-slim`},
{h:'Reading docker history'},
{code:`IMAGE         CREATED       CREATED BY                                      SIZE
a1b2c3d4e5f6  3 weeks ago    CMD ["python3"]                                 0B
<missing>     3 weeks ago    RUN /bin/sh -c set -eux; ... python install     38MB
<missing>     3 weeks ago    ENV PYTHON_VERSION=3.12                          0B
<missing>     3 weeks ago    /bin/sh -c #(nop) ADD file:... in /              80MB`},
{ul:['Each Dockerfile instruction appears as a row. Rows with **0B** only change metadata (ENV, CMD).','`<missing>` is normal: those layers came from a pull and have no local image ID of their own.','Large rows show where the size comes from; this is your guide when shrinking an image.']},
{h:'Image ID versus digest'},
{t:[['','Image ID','Digest'],
['What it is','Hash of the image config','Hash of the manifest'],
['Where you see it','`docker images`','`docker images --digests`, `docker pull` output, registry'],
['Same across machines?','Mostly','Yes: the identifier you can pin and verify']]},
{h:'Layers and containers'},
{flow:['An image is a stack of read-only layers','docker run adds one thin writable layer on top','Reads go down through the layers to find a file','Writes copy the file up into the writable layer (copy-on-write)','Removing the container deletes only that writable layer']},
{note:'A **dangling** image is an untagged image (shown as `<none>`), usually the old version left after a rebuild. They waste space; `docker image prune` removes them.'}],
src:[['Docker images and layers',E+'storage/drivers/#images-and-layers'],['OCI image specification','https://github.com/opencontainers/image-spec'],['docker image inspect',R+'cli/docker/image/inspect/']]};

/* ---------- 1: Working with images ---------- */
L['docker:3:1']={blocks:[
{p:'These are the everyday image commands. Most of them are under `docker image ...`, with older short forms (`docker images`, `docker rmi`) that still work.'},
{t:[['Task','Command'],
['Download from a registry','`docker pull nginx:1.27`'],
['List local images','`docker image ls` (or `docker images`)'],
['Add another name (tag)','`docker tag nginx:1.27 myrepo/web:stable`'],
['Show the full details','`docker image inspect nginx:1.27`'],
['See the layers and their commands','`docker history nginx:1.27`'],
['Remove an image','`docker image rm nginx:1.27` (or `docker rmi`)'],
['Remove unused images','`docker image prune` / `docker image prune -a`'],
['Search Docker Hub','`docker search nginx`']]},
{h:'Pull'},
{code:`docker pull nginx                       # = docker.io/library/nginx:latest
docker pull nginx:1.27                  # a specific tag
docker pull nginx@sha256:3f...         # an exact digest (cannot change)
docker pull --platform linux/arm64 nginx   # another CPU architecture
docker pull -a myrepo/web               # all tags of a repository (careful, can be large)`},
{p:'During a pull each layer is downloaded in parallel. Layers you already have show **Already exists** and are skipped.'},
{h:'List and filter'},
{code:`docker image ls
# REPOSITORY   TAG     IMAGE ID       CREATED       SIZE
# nginx        1.27    a1b2c3d4e5f6   2 weeks ago   192MB

docker image ls nginx                          # one repository
docker image ls --filter dangling=true         # untagged leftovers
docker image ls --filter "reference=myrepo/*"
docker image ls --digests
docker image ls --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"
docker image ls -q                             # IDs only`},
{h:'Tag: one image, many names'},
{p:'A tag is a **label pointing to an image ID**, not a copy. Tagging costs no space.'},
{code:`docker tag nginx:1.27 mycompany/web:1.0
docker tag nginx:1.27 mycompany/web:stable
docker image ls mycompany/web             # both names, same IMAGE ID`},
{svg:K.dg(700,150,[
[250,50,170,50,'Image a1b2c3d4e5f6',2],[10,10,160,34,'nginx:1.27',0],[10,58,160,34,'mycompany/web:1.0',0],[10,106,160,34,'mycompany/web:stable',0]],
[[170,27,250,65],[170,75,250,75],[170,123,250,85]])},
{h:'Remove'},
{code:`docker image rm nginx:1.27            # removes the TAG; the image goes only if no other tag uses it
docker rmi -f a1b2c3d4e5f6             # force, by ID (even if tagged more than once)
docker image prune                     # dangling images only
docker image prune -a                  # every image not used by a container
docker image prune -a --filter "until=720h"   # older than 30 days`},
{ul:['You cannot remove an image used by a container (even a stopped one). Remove the container first.','Removing a tag that is the last one deletes the layers that no other image uses.','`docker image prune -a` is powerful; on a build server, check what is unused first.']},
{h:'Search and trust'},
{code:`docker search nginx --limit 5
docker search --filter is-official=true nginx
# search shows names only. Read the Docker Hub page before using an unknown image.`},
{h:'Disk usage'},
{code:`docker system df              # images, containers, volumes, build cache
docker system df -v           # per-image detail, including shared size`},
{note:'The SIZE column shows the image **virtual size**. Because layers are shared, the total disk used by several images is smaller than the sum of their sizes.'},
{h:'Quick troubleshooting'},
{t:[['Message','Meaning'],
['`pull access denied ... repository does not exist or may require authorization`','Wrong name, or a private image and you are not logged in'],
['`manifest unknown`','The tag does not exist in that repository'],
['`no matching manifest for linux/arm64`','The image has no variant for your CPU; try `--platform`'],
['`image is being used by running container`','Stop and remove the container first']]}],
src:[['docker pull',R+'cli/docker/image/pull/'],['docker image ls',R+'cli/docker/image/ls/'],['docker image prune',R+'cli/docker/image/prune/']]};

/* ---------- 2: containerd image store vs classic ---------- */
L['docker:3:2']={blocks:[
{p:'Docker Engine can keep images in two different ways. You use the same commands either way, but features and storage locations differ.'},
{svg:stores},
{t:[['','Classic image store','containerd image store'],
['Who stores images','dockerd with a **graph driver** (overlay2)','**containerd** with a snapshotter (overlayfs)'],
['Location on disk','`/var/lib/docker/image` and `overlay2`','containerd directories (under the Docker data-root)'],
['Multi-platform images locally','Limited','Supported (keeps the full image index)'],
['Attestations (SBOM, provenance)','Not stored locally','Supported'],
['Lazy pulling, other snapshotters','No','Possible'],
['`docker info` shows','Storage Driver: overlay2','Storage Driver: overlayfs, driver-type: io.containerd.snapshotter.v1']]},
{p:'**Version note:** Engine 29 made the containerd image store the **default for new installations only**. Existing installations keep the store they already use, so upgrading does not move your images.'},
{h:'Check which store you have'},
{code:`docker info | grep -E "Storage Driver|driver-type"
# Storage Driver: overlayfs
#  driver-type: io.containerd.snapshotter.v1     <- containerd image store

# Storage Driver: overlay2                       <- classic store`},
{h:'Choose the store'},
{p:'In `/etc/docker/daemon.json`:'},
{code:`{ "features": { "containerd-snapshotter": true } }      // use the containerd image store
{ "features": { "containerd-snapshotter": false } }     // use the classic store`},
{note:'The two stores are **separate**. When you switch, images from the other store are not visible until you switch back. They are not deleted and not migrated automatically. To move images use `docker save` and `docker load`, or push to a registry and pull again.'},
{h:'What changes for you'},
{ul:['**Listing:** images may show per-platform entries and index details; `docker image ls` can look slightly different.','**Exports:** `docker save` and `docker load` work, and can select a platform; multi-platform archives can be larger.','**Builds:** you can build and keep multi-platform images locally without pushing.','**Disk:** layer data lives under containerd paths, so monitor the same data-root disk.','**Tools:** scripts that read `/var/lib/docker/overlay2` directly must be reviewed.']},
{h:'Decision guide'},
{flow:['New installation: accept the default store for your Engine version','Existing production host: stay on its current store unless you have a reason to change','Need local multi-platform builds or attestations: use the containerd store','Before any change: back up and list your images']},
{code:`# Safe migration of a few images between stores
docker save -o backup.tar app:1.0 db:2.3     # while on the old store
# switch the setting, restart docker
sudo systemctl restart docker
docker load -i backup.tar                     # into the new store`}],
src:[['containerd image store',K.D+'engine/storage/containerd/'],['Storage drivers',E+'storage/drivers/']]};

/* ---------- 3: Docker Hub, official images, trusted content ---------- */
L['docker:3:3']={blocks:[
{p:'**Docker Hub** is the default public registry. When you type `docker pull nginx` the image comes from Hub. Hub contains millions of images, so knowing **which ones to trust** is a basic security skill.'},
{h:'Kinds of content'},
{t:[['Label','Meaning','Trust level'],
['**Docker Official Image**','Curated set (nginx, postgres, python, redis...). Maintained to Docker best practices, scanned and documented, named without a user prefix (`nginx`)','High'],
['**Verified Publisher**','From a commercial partner whose identity Docker verified','High'],
['**Docker-Sponsored Open Source**','From open-source projects Docker sponsors','Medium to high'],
['Community image','Published by any user (`someuser/tool`)','Unknown: verify yourself']]},
{h:'Search and read before you pull'},
{code:`docker search --filter is-official=true postgres
# In a browser: hub.docker.com/_/postgres  (the page shows tags, supported architectures, usage, vulnerabilities)`},
{h:'How to evaluate an image'},
{ul:['**Who publishes it?** Official, Verified Publisher or an unknown user?','**Is it maintained?** Check last push date and how often tags update.','**Is the source visible?** A linked repository with the Dockerfile is a good sign.','**What is inside?** Read the Dockerfile or run `docker history`; scan with Docker Scout (Section 9).','**Which tags exist?** Prefer versioned tags and slim or alpine variants where suitable.','**Does it run as root?** Many do; plan to harden.']},
{h:'Tag variants you will see'},
{t:[['Tag suffix','Meaning'],
['`1.27`, `1.27.3`','Version (major.minor, or exact patch)'],
['`latest`','Newest default build; moves over time, do not use in production'],
['`-alpine`','Based on Alpine Linux: very small, uses musl libc'],
['`-slim`','Debian with fewer packages'],
['`-bookworm`, `-jammy`','Tied to a specific operating system release']]},
{h:'Authentication and limits'},
{ul:['Pulls from Hub are **rate limited**, with limits depending on whether you are anonymous or logged in and on your plan. Check the current limits on Docker site.','CI systems that share one IP can reach the limit quickly. Log in, use a mirror or cache (Additional content) or host copies in your own registry.','Use a **personal access token** instead of your password for `docker login` in scripts.']},
{code:`docker login -u myuser                # prompts for a token or password
# Check your remaining pulls (needs curl and jq)
TOKEN=$(curl -s "https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull" | jq -r .token)
curl -sI -H "Authorization: Bearer $TOKEN" https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest | grep -i ratelimit`},
{h:'Safe pulling habits'},
{flow:['Prefer Official or Verified images','Pin a version tag, and for important systems the digest','Scan the image before use','Copy trusted images to your own private registry','Rebuild and update regularly to receive security patches']},
{note:'A popular image name is not proof of safety. Attackers publish look-alike names (typosquatting). Type names carefully and check the publisher.'}],
src:[['Docker Hub',K.D+'docker-hub/'],['Docker Official Images',K.D+'docker-hub/image-library/trusted-content/'],['Hub usage and limits',K.D+'docker-hub/usage/']]};

/* ---------- 4: Private registries ---------- */
L['docker:3:4']={blocks:[
{p:'A **registry** stores images. Besides Docker Hub you can use cloud registries (GitHub Container Registry, Amazon ECR, Azure ACR, Google Artifact Registry), products like Harbor, or run a simple one yourself. A **private registry** requires login to pull or push.'},
{svg:regflow},
{h:'Login and logout'},
{code:`docker login                              # Docker Hub
docker login ghcr.io -u myuser            # another registry
echo "$TOKEN" | docker login ghcr.io -u myuser --password-stdin    # safe for scripts
docker logout ghcr.io`},
{note:'Never type a password on the command line with `-p`: it ends up in shell history and process lists. Use `--password-stdin`.'},
{h:'Where credentials are stored'},
{p:'Login saves the credentials in `~/.docker/config.json`. How they are saved depends on whether a **credential helper** is configured.'},
{t:[['Mode','How stored','Safety'],
['No helper','Base64 text in config.json under `auths`','Weak: base64 is not encryption'],
['**Credential helper**','Handed to the operating system secure store','Better']]},
{code:`# ~/.docker/config.json with a helper
{
  "credsStore": "desktop"        // Docker Desktop's store
}
# Other helpers: osxkeychain (macOS), wincred (Windows), secretservice or pass (Linux)
# Per-registry:  "credHelpers": { "123456789.dkr.ecr.eu-west-1.amazonaws.com": "ecr-login" }`},
{ul:['Docker Desktop configures a helper for you.','On Linux servers install `docker-credential-pass` or `docker-credential-secretservice`, or use short-lived tokens from the cloud provider.','In CI use the pipeline secret store and `--password-stdin`.']},
{h:'Image names for other registries'},
{code:`registry-host[:port]/namespace/repository:tag
ghcr.io/acme/web:1.0
123456789.dkr.ecr.eu-west-1.amazonaws.com/web:1.0
registry.lan:5000/team/web:1.0`},
{h:'Run your own registry: registry:2'},
{p:'`registry:2` is the open-source Distribution registry in a container. It is excellent for learning and small labs.'},
{code:`docker run -d --name registry --restart unless-stopped \\
  -p 5000:5000 -v registry-data:/var/lib/registry registry:2

# Push something to it
docker pull alpine:3.20
docker tag alpine:3.20 localhost:5000/alpine:3.20
docker push localhost:5000/alpine:3.20

# Ask the registry API what it has
curl http://localhost:5000/v2/_catalog          # {"repositories":["alpine"]}
curl http://localhost:5000/v2/alpine/tags/list`},
{h:'TLS: the rule you must know'},
{ul:['Docker requires **HTTPS** for registries, except `localhost` which may use plain HTTP.','For a registry on another host, give it a TLS certificate. If the certificate is private, place the CA at `/etc/docker/certs.d/registry.lan:5000/ca.crt`.','`insecure-registries` in daemon.json allows plain HTTP, only for throw-away labs.','A real private registry also needs authentication (htpasswd or token service) and backups. See Additional content on hardening.']},
{code:`// /etc/docker/daemon.json (lab only)
{ "insecure-registries": ["registry.lan:5000"] }`},
{h:'Common errors'},
{t:[['Message','Meaning and fix'],
['`http: server gave HTTP response to HTTPS client`','Registry has no TLS: add TLS, or insecure-registries for a lab'],
['`unauthorized: authentication required`','Run `docker login` for that registry host'],
['`denied: requested access to the resource is denied`','Logged in but no permission, or wrong namespace'],
['`x509: certificate signed by unknown authority`','Install the CA in `/etc/docker/certs.d/<host>/`']]}],
src:[['Deploy a registry server',K.D+'registry/deploying/'],['docker login',R+'cli/docker/login/'],['Credential stores',R+'cli/docker/login/#credential-stores']]};

/* ---------- 5: save/load/export/import ---------- */
L['docker:3:5']={blocks:[
{p:'Sometimes there is no registry: an air-gapped server, a USB handover, or a quick backup. Docker can move images and container file systems as **tar files**. Four commands exist, and two pairs are easy to confuse.'},
{t:[['Command','Works on','Keeps','Result'],
['`docker save`','**Image(s)**','Layers, tags, history, metadata','A tar of images'],
['`docker load`','Image tar','','Restores the images with their tags'],
['`docker export`','**Container**','Only the flattened file system','A tar of files; **no** history, ports, env or command'],
['`docker import`','Filesystem tar','','Creates a **new single-layer image**']]},
{svg:K.dg(700,200,[
[10,20,150,50,'Image',0],[10,130,150,50,'Container',0],
[270,20,150,50,'image.tar|layers + metadata',2],[270,130,150,50,'files.tar|just files',2],
[540,20,150,50,'Image (same)',0],[540,130,150,50,'New image|1 layer, no metadata',0]],
[[160,45,270,45],[420,45,540,45],[160,155,270,155],[420,155,540,155]])},
{h:'save and load: the normal way to move images'},
{code:`# Save one or several images
docker save -o app.tar myapp:1.0
docker save -o stack.tar myapp:1.0 redis:7 nginx:1.27

# Compress while saving (tar of layers compresses well)
docker save myapp:1.0 | gzip > app.tar.gz

# On the other machine
docker load -i app.tar
docker load < app.tar.gz            # gzip is detected automatically
docker image ls`},
{ul:['Tags are restored exactly as saved; use full names with tags when saving.','The archive contains every layer, so it can be large; share common base layers by saving related images together.','On the containerd image store, `--platform` selects which platform to save or load for multi-platform images.']},
{h:'export and import: the flat file system'},
{code:`docker run --name tmp alpine sh -c "echo hi > /note.txt"
docker export tmp -o tmp-fs.tar                 # or: docker export tmp > tmp-fs.tar
tar -tf tmp-fs.tar | head                       # a plain list of files

# Make an image out of those files
docker import tmp-fs.tar flat:1.0
docker run --rm flat:1.0 cat /note.txt          # hi

# Optionally set metadata that was lost
docker import --change 'CMD ["/bin/sh"]' tmp-fs.tar flat:2.0`},
{note:'A container that was exported and imported loses its command, environment variables and exposed ports, and the image history. If you want to keep an image faithfully, use **save/load**, not export/import.'},
{h:'When to use which'},
{flow:['Copy an image to another host without a registry: save, then load','Flatten an image into a single layer or start from a rootfs: export, then import','Share images in a normal workflow: push to a registry','Back up volume data: use a helper container (Section 7), not export']},
{h:'Security notes'},
{ul:['Only `docker load` archives you trust. An archive is a set of files the daemon will unpack.','Verify checksums of transferred files: `sha256sum app.tar`.','Do not leave secrets inside an image you save; layers keep them.']}],
src:[['docker image save',R+'cli/docker/image/save/'],['docker image load',R+'cli/docker/image/load/'],['docker container export',R+'cli/docker/container/export/'],['docker image import',R+'cli/docker/image/import/']]};

/* ---------- 6: docker commit ---------- */
L['docker:3:6']={blocks:[
{p:'`docker commit` creates a **new image from the current state of a container**. You change a container by hand, then freeze the result as an image. It is quick, but it is not how images should normally be made.'},
{flow:['Start a container from an image','Change things inside it (install a package, edit a file)','docker commit saves its writable layer as a new image layer','You get a new image you can run, tag and push']},
{code:`docker run -it --name work ubuntu bash
  apt-get update && apt-get install -y curl
  exit

docker diff work                                  # A=added C=changed D=deleted files
docker commit -m "add curl" -a "me" work myrepo/ubuntu-curl:1.0
docker image ls myrepo/ubuntu-curl
docker history myrepo/ubuntu-curl:1.0             # one extra layer: add curl
docker run --rm myrepo/ubuntu-curl:1.0 curl --version`},
{h:'Useful options'},
{t:[['Option','Effect'],
['`-m "message"`','Commit message stored in the image history'],
['`-a "author"`','Author field'],
['`-c "CMD [\\"nginx\\"]"` / `--change`','Apply a Dockerfile instruction (CMD, ENV, EXPOSE, ENTRYPOINT...) in the new image'],
['`-p=false`','Do not pause the container during the commit (default pauses it)']]},
{h:'What a commit does not include'},
{ul:['Data in **volumes**: mounted volumes are not part of the container layer.','Data in bind mounts and tmpfs.','Anything stored outside the container file system.']},
{h:'Why not to use it for real work'},
{t:[['Problem','Explained'],
['**Not repeatable**','Nobody knows exactly what you typed; you cannot rebuild it reliably'],
['**Not reviewable**','There is no file to put in version control or review'],
['**Hidden junk**','Package caches, shell history and temporary files get baked in'],
['**Security**','You cannot easily audit it, and old vulnerabilities stay'],
['**Size**','Layers accumulate and cannot be optimised like a good Dockerfile']]},
{p:'Use a **Dockerfile** (Section 5) for anything that must be rebuilt, shared or audited. The commit is acceptable for these cases:'},
{ul:['Saving the state of an experiment or a lab to continue later.','A quick forensic copy of a broken container for investigation.','Learning how layers work.']},
{h:'Better alternative: turn your hand steps into a Dockerfile'},
{code:`# What you did by hand:
#   apt-get update && apt-get install -y curl
# becomes a repeatable file:
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends curl \\
 && rm -rf /var/lib/apt/lists/*`},
{note:'Exam tip: remember that `docker commit` takes a **container** and produces an **image**, and that it does not capture volume data.'}],
src:[['docker commit',R+'cli/docker/container/commit/'],['docker diff',R+'cli/docker/container/diff/']]};

/* ---------- 7: Tags, versioning and immutability ---------- */
L['docker:3:7']={blocks:[
{p:'A **tag** is a human-friendly name for an image, such as `1.27` or `latest`. The most important fact about tags: **a tag is a movable pointer, not a version.** The owner of a repository can push a different image under the same tag at any time.'},
{svg:K.dg(700,170,[
[10,20,130,40,'web:1.0',0],[10,110,130,40,'web:latest',0],
[260,20,170,40,'digest sha256:aaa...',0],[260,110,170,40,'digest sha256:bbb...',0],
[540,45,150,60,'Today: latest ->|sha256:bbb...|(was aaa yesterday)',2]],
[[140,40,260,40],[140,130,260,130],[430,130,540,90]])},
{h:'Why latest is not a version'},
{ul:['It is only the default tag when you give none, and it means "whatever was pushed last without another tag".','Two servers pulling `latest` on different days can get **different software**.','A rollback to `latest` is impossible: it already moved.']},
{h:'Common tagging schemes'},
{t:[['Scheme','Example','Use'],
['**Semantic version**','`1.4.2`, plus moving `1.4`, `1`','Libraries and releases; the exact tag is stable, shorter ones follow patches'],
['**Git commit**','`a1b2c3d`','Every CI build traceable to code'],
['**Date or build number**','`2025-10-09`, `build-482`','Simple ordering for CI'],
['**Environment**','`staging`, `prod`','Moving labels for promotion (combine with an immutable tag)']]},
{code:`# Tag one build several ways
docker build -t myapp:1.4.2 .
docker tag myapp:1.4.2 myapp:1.4
docker tag myapp:1.4.2 myapp:1
docker tag myapp:1.4.2 myapp:a1b2c3d
docker push --all-tags myapp`},
{h:'Pin by digest for guaranteed immutability'},
{p:'A **digest** is the hash of the manifest. It can never point to anything else.'},
{code:`# Get the digest
docker inspect --format '{{index .RepoDigests 0}}' nginx:1.27
docker buildx imagetools inspect nginx:1.27

# Use it
docker pull nginx@sha256:3f1c...
docker run nginx:1.27@sha256:3f1c...      # tag for humans + digest for safety (the digest wins)`},
{t:[['Reference','Stable?','Readable?'],
['`nginx:latest`','No','Yes'],
['`nginx:1.27`','Mostly (patch updates may move it)','Yes'],
['`nginx:1.27.3`','Usually (but a publisher may rebuild it)','Yes'],
['`nginx@sha256:...`','**Always**','No']]},
{note:'Official images are rebuilt often to include security fixes, even for the same version tag. If you pin a digest you must also **update it on purpose** (for example with an automated tool).'},
{h:'Immutable tags on registries'},
{p:'Several registries can be set to refuse overwriting an existing tag (an **immutable tags** setting). This makes `1.4.2` mean exactly one image forever, while moving tags like `latest` or `stable` can be exempted. Check your registry for the setting.'},
{h:'Practical rules'},
{ul:['Deploy by **version tag or digest**, never `latest`.','Record the digest that was tested and deploy that same digest in production.','Keep old tags so you can roll back.','Clean up with a retention policy, not by hand.']},
{flow:['CI builds the image and tags it with the git commit','Tests run against that exact image','It is promoted by adding a release tag (1.4.2) with no rebuild','Production deploys by the digest of that image']}],
src:[['Tagging',K.D+'build/building/best-practices/#pin-base-image-versions'],['docker tag',R+'cli/docker/image/tag/'],['OCI image digests','https://github.com/opencontainers/image-spec/blob/main/descriptor.md#digests']]};

/* ---------- 8: Practical ---------- */
L['docker:3:8']={blocks:[
{p:'**Goal:** run your own registry, push an image to it, delete the image locally, then pull it back by tag and by digest, and finally move it with save/load. You will use almost everything in this section.'},
{flow:['Start registry:2 with a volume','Tag an image for the registry and push it','Inspect the registry with its API','Remove the local copies and pull by tag','Pull by digest and confirm it is the same image','Move an image with save and load, then clean up']},
{h:'Step 1: start the registry'},
{code:`docker run -d --name registry --restart unless-stopped \\
  -p 5000:5000 -v registry-data:/var/lib/registry registry:2
docker ps --filter name=registry
curl http://localhost:5000/v2/            # {}   means the registry answers`},
{h:'Step 2: tag and push'},
{code:`docker pull nginx:1.27-alpine
docker tag nginx:1.27-alpine localhost:5000/lab/web:1.0
docker tag nginx:1.27-alpine localhost:5000/lab/web:stable
docker image ls localhost:5000/lab/web           # two names, one IMAGE ID

docker push localhost:5000/lab/web:1.0
docker push localhost:5000/lab/web:stable        # layers already exist, tiny upload
# the last lines show:  1.0: digest: sha256:... size: ...`},
{h:'Step 3: ask the registry'},
{code:`curl -s http://localhost:5000/v2/_catalog
curl -s http://localhost:5000/v2/lab/web/tags/list
# {"name":"lab/web","tags":["1.0","stable"]}`},
{h:'Step 4: delete locally, pull by tag'},
{code:`docker image rm localhost:5000/lab/web:1.0 localhost:5000/lab/web:stable nginx:1.27-alpine
docker image ls | grep -E "web|nginx" || echo "gone"

docker pull localhost:5000/lab/web:1.0
docker run -d --name t1 -p 8081:80 localhost:5000/lab/web:1.0
curl -I http://localhost:8081                    # HTTP/1.1 200 OK
docker rm -f t1`},
{h:'Step 5: pull by digest'},
{code:`DIGEST=$(docker inspect --format '{{index .RepoDigests 0}}' localhost:5000/lab/web:1.0)
echo $DIGEST                                     # localhost:5000/lab/web@sha256:...
docker image rm localhost:5000/lab/web:1.0
docker pull $DIGEST                              # exactly the same bytes
docker image ls --digests localhost:5000/lab/web`},
{h:'Step 6: no registry? save and load'},
{code:`docker tag $DIGEST lab/web:offline
docker save lab/web:offline | gzip > web-offline.tar.gz
ls -lh web-offline.tar.gz
docker image rm lab/web:offline
docker load < web-offline.tar.gz
docker image ls lab/web`},
{h:'Checkpoints'},
{t:[['Check','Expected'],
['`curl localhost:5000/v2/_catalog`','`{"repositories":["lab/web"]}`'],
['Two tags, one image ID','Same IMAGE ID for `1.0` and `stable`'],
['Pull after removal','Layers downloaded again (not "already exists")'],
['Digest pull','Works; tag is not needed'],
['load output','`Loaded image: lab/web:offline`']]},
{h:'Cleanup'},
{code:`docker rm -f registry
docker volume rm registry-data
docker image prune -a -f --filter "label!=keep"   # optional, removes unused images
rm web-offline.tar.gz`},
{h:'Stretch goals'},
{ul:['Run the registry on a second machine with a real certificate and pull from your first machine.','Add basic authentication with an htpasswd file and use `docker login`.','Write a small script that pushes a build with the git commit as the tag.']}],
src:[['Deploy a registry server',K.D+'registry/deploying/'],['Registry HTTP API',K.D+'registry/spec/api/']]};
})();
