/* LearnSphere - Docker, Section 07: Storage & Volumes.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs docker-common.js. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R;
const S=E+'storage/';

/* ---------- diagrams ---------- */
const three=K.dg(700,250,[
[10,10,680,230,'Where a container can keep data',1],
[30,45,200,50,'Container',2],
[290,45,170,50,'Volume|managed by Docker|/var/lib/docker/volumes',0],[480,45,190,50,'Bind mount|a host folder you choose',0],[290,130,170,50,'tmpfs|memory only',0],[30,130,200,50,'Writable layer|deleted with container',0],
[480,130,190,60,'Survives the container?|Volume: yes  Bind: yes|tmpfs: no  Layer: no',0]],
[[230,70,290,70],[230,75,480,75],[130,95,130,130],[230,100,290,150]]);

const layer=K.dg(700,220,[
[10,10,330,200,'Container filesystem',1],[380,40,310,140,'docker rm web|Container and its writable|layer are deleted:|DATA IS GONE',2],
[30,45,290,40,'Writable layer (your data lands here)',2],[30,95,290,34,'Image layer 2 (read-only)',0],[30,139,290,34,'Image layer 1 (read-only)',0]],
[[340,100,380,100]]);

/* ---------- 0: writable layer ---------- */
L['docker:6:0']={blocks:[
{p:'A container starts from a read-only image and receives one thin **writable layer** on top. Everything the container writes without a mount goes into that layer. The layer belongs to the container: **when the container is removed, the data is deleted with it.**'},
{svg:layer},
{h:'Copy-on-write'},
{p:'Reading a file reads it from the image layers. The first time a file is **changed**, Docker copies it up into the writable layer and changes the copy. The image itself never changes.'},
{flow:['Container reads /etc/app.conf from a read-only image layer','Container edits the file','Docker copies the file into the writable layer (copy-up)','The container now sees the modified copy; the image still holds the original','On docker rm the writable layer, and the change, disappear']},
{h:'See it'},
{code:`docker run -d --name demo alpine sh -c "echo hello > /data.txt && sleep 1d"
docker diff demo                 # A /data.txt  (A=added, C=changed, D=deleted)
docker ps -s                     # SIZE shows writable layer size and the virtual (image) size
docker exec demo cat /data.txt   # hello

docker stop demo && docker start demo
docker exec demo cat /data.txt   # still there: same container, same layer

docker rm -f demo
docker run --rm alpine cat /data.txt   # No such file: a new container, a new empty layer`},
{h:'What survives what'},
{t:[['Action','Writable layer data'],
['`docker stop` / `docker start`','Kept'],
['`docker restart`, daemon restart','Kept'],
['`docker rm`','**Deleted**'],
['`docker run` again (new container)','Not there; starts clean'],
['Image rebuild / pull of a newer image','New containers start clean']]},
{h:'Limits of the writable layer'},
{ul:['**Not durable:** tied to one container.','**Not shareable:** other containers cannot use it.','**Slower:** copy-on-write through the storage driver is slower than a volume for heavy writes (databases, logs).','**Hard to back up:** it lives inside Docker storage.']},
{h:'The cure: put important data elsewhere'},
{svg:three},
{t:[['Option','Use for'],
['**Volume**','Application data (databases, uploads)'],
['**Bind mount**','Sharing host files, such as source code in development'],
['**tmpfs**','Temporary or sensitive data that must not hit disk'],
['Writable layer','Throw-away scratch space only']]},
{note:'A containerized application should be **stateless** where possible: logs to stdout, state in volumes or external services. Then containers can be replaced freely.'}],
src:[['Storage overview',S],['Storage drivers',S+'drivers/'],['docker diff',R+'cli/docker/container/diff/']]};

/* ---------- 1: volumes ---------- */
L['docker:6:1']={blocks:[
{p:'A **volume** is storage managed by Docker that **outlives containers**. Docker creates and owns the directory (on Linux under `/var/lib/docker/volumes`), and you attach it to containers at a path you choose.'},
{h:'Named and anonymous volumes'},
{t:[['','Named volume','Anonymous volume'],
['Created by','`docker volume create data` or on first use `-v data:/path`','`-v /path` (no name) or a VOLUME instruction'],
['Name','You choose (`data`)','Random 64-character ID'],
['Reuse','Easy: refer to it by name','Hard to track; often orphaned'],
['Recommended','**Yes**','Only for temporary needs']]},
{h:'Two syntaxes'},
{code:`# Short: -v name:path[:options]
docker run -d --name db -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=pw postgres:16

# Long: --mount (explicit, clearer, recommended)
docker run -d --name db \\
  --mount type=volume,src=pgdata,dst=/var/lib/postgresql/data \\
  -e POSTGRES_PASSWORD=pw postgres:16`},
{t:[['--mount key','Meaning'],
['`type=volume`','Kind of mount (`volume`, `bind`, `tmpfs`)'],
['`src=` or `source=`','Volume name (omit for anonymous)'],
['`dst=`, `destination=`, `target=`','Path inside the container'],
['`readonly` or `ro`','Mount read-only'],
['`volume-subpath=`','Mount only a sub-directory of the volume']]},
{h:'Manage volumes'},
{code:`docker volume create pgdata
docker volume ls
docker volume inspect pgdata
# "Mountpoint": "/var/lib/docker/volumes/pgdata/_data"

docker volume rm pgdata               # fails if any container uses it
docker volume prune                   # remove volumes not used by any container (CAREFUL)
docker volume ls -f dangling=true     # unused volumes
docker system df -v                   # sizes`},
{h:'Key behaviours'},
{ul:['**Volumes outlive containers.** `docker rm` leaves named volumes in place (use `docker rm -v` to also remove anonymous ones).','**Initial content:** when you mount an **empty** new volume over a path that has files in the image, Docker copies those files into the volume first. Mounting a non-empty volume hides the image files at that path.','**Sharing:** many containers can mount the same volume. Make sure the application handles concurrent access.','**Read-only:** `-v data:/config:ro` prevents the container from changing it.','**Docker Desktop:** the volume lives inside the Desktop VM, not directly on your computer file system.']},
{code:`docker run --rm -v demo:/data alpine sh -c "echo saved > /data/file.txt"
docker run --rm -v demo:/data alpine cat /data/file.txt     # saved  (a different container)
docker run --rm -v demo:/data:ro alpine sh -c "touch /data/x"   # Read-only file system`},
{h:'Where does the data really live?'},
{code:`docker volume inspect pgdata -f '{{.Mountpoint}}'
sudo ls /var/lib/docker/volumes/pgdata/_data      # Linux only; do not edit by hand
# Back up or change data through containers, not by editing this directory`},
{h:'Why volumes are the preferred choice'},
{t:[['Benefit','Meaning'],
['Independent lifecycle','Survive container removal and image updates'],
['Easier backup and migration','Standard tools and helper containers'],
['Better performance','Bypass the copy-on-write layer'],
['Work on Linux and Windows','Not tied to host directory layout'],
['Support drivers','Network or cloud storage with volume plugins'],
['Safer','Do not expose arbitrary host paths']]},
{note:'`docker volume prune` deletes **all unused** volumes, including ones that hold data you forgot about. Check `docker volume ls` first, and prefer deleting by name.'}],
src:[['Volumes',S+'volumes/'],['docker volume',R+'cli/docker/volume/']]};

/* ---------- 2: bind mounts ---------- */
L['docker:6:2']={blocks:[
{p:'A **bind mount** maps a file or folder **that already exists on the host** into the container. Both sides see the same files at the same time. It is the tool for development: edit code on your computer, run it in the container.'},
{code:`# Share the current folder with the container
docker run --rm -it -v "$PWD":/app -w /app node:22 sh
# or the explicit form
docker run --rm -it --mount type=bind,src="$PWD",dst=/app -w /app node:22 sh

# Read-only configuration file
docker run -d --name web -p 8080:80 \\
  -v "$PWD/nginx.conf":/etc/nginx/nginx.conf:ro nginx`},
{h:'-v versus --mount for bind mounts'},
{t:[['Case','`-v host:container`','`--mount type=bind,...`'],
['Host path does not exist','Docker **creates a directory** there (a classic source of confusion)','**Error**: path must exist'],
['Style','Compact','Explicit and readable'],
['Options','`:ro`, `:z`, `:Z`','`readonly`, `bind-propagation=...`']]},
{h:'Typical uses'},
{ul:['**Development:** source code mounted into a container with the toolchain (live reload).','**Configuration:** a single config file mounted read-only.','**Sharing output:** results written to a host folder.','**Reading host data:** logs or metrics (read-only).']},
{h:'Common problems'},
{t:[['Problem','Cause and fix'],
['**Permission denied** writing files','The container user ID differs from the owner of the host folder. Run with `--user $(id -u):$(id -g)` or fix ownership.'],
['Files created by the container are owned by **root** on the host','The container ran as root. Use a non-root user or `--user`.'],
['A folder appeared where you expected a file','`-v` created a directory for a missing path. Create the file first, or use `--mount`.'],
['**SELinux** blocks access (RHEL, Fedora)','Add `:z` (shared label) or `:Z` (private label): `-v "$PWD":/app:Z`'],
['Slow file access on **Docker Desktop**','Files cross the VM boundary. On Windows keep projects inside WSL; consider Compose Watch.'],
['The mount hides files that were in the image','A bind mount **covers** the image content at that path']]},
{h:'Security risks'},
{ul:['A bind mount gives the container access to part of the **host file system**. If the container is compromised, the host files are exposed.','**Never** bind-mount sensitive paths unless needed: `/`, `/etc`, `/var/run/docker.sock`, `/root`.','Mounting `/var/run/docker.sock` gives the container control of Docker, which is root on the host.','Use `:ro` whenever the container only needs to read.','Prefer **volumes** for application data.']},
{code:`# What NOT to do
docker run -v /:/host alpine chroot /host    # a root shell on the HOST file system
docker run -v /var/run/docker.sock:/var/run/docker.sock docker   # controls the daemon`},
{h:'Inspect what is mounted'},
{code:`docker inspect -f '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}} rw={{.RW}}{{println}}{{end}}' web`}],
src:[['Bind mounts',S+'bind-mounts/'],['Use bind mounts in development',S+'bind-mounts/#start-a-container-with-a-bind-mount']]};

/* ---------- 3: tmpfs ---------- */
L['docker:6:3']={blocks:[
{p:'A **tmpfs mount** stores data in the host **memory** (RAM), not on disk. It disappears when the container stops. It is fast and leaves no traces on disk.'},
{code:`docker run --rm --tmpfs /tmp alpine df -h /tmp
docker run -d --name app \\
  --tmpfs /run:rw,noexec,nosuid,size=64m \\
  nginx

# --mount form
docker run --rm --mount type=tmpfs,dst=/cache,tmpfs-size=100m,tmpfs-mode=1777 alpine df -h /cache`},
{t:[['Option','Meaning'],
['`size=64m` / `tmpfs-size`','Maximum size (default: half of host RAM, so set it)'],
['`tmpfs-mode=1777`','Permission bits of the mount'],
['`noexec`, `nosuid`, `nodev`','Hardening flags']]},
{h:'When to use tmpfs'},
{ul:['**Sensitive temporary data** (tokens, decrypted files) that must never be written to disk.','**Scratch space** and caches that benefit from speed.','**Read-only root file system:** keep the root read-only and give `/tmp` and `/run` a tmpfs (Section 9 practical).']},
{h:'Limits'},
{ul:['Data is **lost** when the container stops. It is not shared with other containers.','It uses **RAM** (and swap): a runaway process can use up memory. Always set a size.','tmpfs mounts work on **Linux** containers (Engine; on Desktop inside its VM). They are not available for Windows containers.']},
{h:'Quick comparison'},
{t:[['','Volume','Bind mount','tmpfs'],
['Stored in','Docker area on disk','Host path you pick','RAM'],
['Persists after stop','Yes','Yes','No'],
['Shared between containers','Yes','Yes','No'],
['Speed','Good','Depends on host','Fastest']]},
{note:'Do not confuse `--tmpfs` with `--mount type=volume`. Only tmpfs is memory-backed and temporary.'}],
src:[['tmpfs mounts',S+'tmpfs/']]};

/* ---------- 4: choosing ---------- */
L['docker:6:4']={blocks:[
{p:'Three mount types solve different problems. Choose by asking: **Does the data need to survive? Who owns the files? Is it sensitive?**'},
{h:'Side by side'},
{t:[['','Volume','Bind mount','tmpfs'],
['Managed by Docker','Yes','No (host path)','Yes (memory)'],
['Survives container removal','Yes','Yes','No'],
['Needs a pre-existing host path','No','Yes','No'],
['Backup','Easy (helper container)','Normal host tools','Not applicable'],
['Exposes host files','No','**Yes**','No'],
['Performance','Good','Host-dependent; slower on Desktop','Fastest'],
['Typical','Databases, uploads','Source code, config','Secrets, scratch']]},
{h:'Decision by use case'},
{t:[['Use case','Choose','Why'],
['Database files (PostgreSQL, MySQL)','**Volume**','Durable, fast, portable'],
['User uploads, application data','**Volume**','Durable and easy to back up'],
['Source code while developing','**Bind mount**','You edit on the host, container sees it at once'],
['One configuration file','**Bind mount** (read-only)','Simple; change without rebuilding'],
['Build output to share with the host','**Bind mount**','Files appear on the host'],
['Cache that can be rebuilt','**Volume** or tmpfs','Volume if it should survive restarts'],
['Secrets at run time','**tmpfs** / orchestrator secrets','Never written to disk'],
['Temporary scratch space','**tmpfs**','Fast and auto-cleaned'],
['Data shared between several containers','**Volume**','Same named volume mounted in each'],
['Data stored on a NAS or cloud','**Volume** with a driver','NFS or plugin-backed']]},
{flow:['Does it need to survive container removal? No: tmpfs or the writable layer','Yes: is it source code or a file you edit on the host? Bind mount','Otherwise: use a named volume']},
{h:'Rules of thumb'},
{ul:['**Default to named volumes** for anything that matters.','Use bind mounts for development and for single files that **you** manage.','Mount read-only (`:ro`) whenever the container does not need to write.','Never bind-mount the Docker socket or system folders unless you understand the risk.','Write logs to stdout, not into mounts.']},
{h:'Same app, three ways'},
{code:`# Production database: volume
docker run -d --name db -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=pw postgres:16

# Development web app: bind mount for code, volume for dependencies
docker run -d --name dev -v "$PWD":/app -v node_modules:/app/node_modules -w /app node:22 npm start

# Sensitive scratch: tmpfs
docker run -d --name worker --tmpfs /secrets:size=1m,mode=0700 myworker`}],
src:[['Storage overview',S],['Manage data in Docker',S+'#choose-the-right-type-of-mount']]};

/* ---------- 5: backup, restore, migrate ---------- */
L['docker:6:5']={blocks:[
{p:'A volume is a Docker-managed folder, so the clean way to back it up is **another container** that mounts the volume and writes a tar file to a bind mount. The same trick restores and migrates data on any host.'},
{svg:K.dg(700,190,[
[10,60,150,60,'Volume|pgdata',2],[240,50,200,80,'Helper container|alpine + tar|mounts volume (ro)',0],[520,60,170,60,'backup.tar.gz|in a host folder',0]],
[[160,90,240,90],[440,90,520,90]])},
{h:'Back up'},
{code:`# 1. Create the backup file in the current folder
docker run --rm \\
  -v pgdata:/source:ro \\
  -v "$PWD":/backup \\
  alpine tar czf /backup/pgdata-$(date +%F).tar.gz -C /source .

ls -lh pgdata-*.tar.gz
tar tzf pgdata-*.tar.gz | head          # verify contents`},
{h:'Restore'},
{code:`docker volume create pgdata-restored
docker run --rm \\
  -v pgdata-restored:/target \\
  -v "$PWD":/backup:ro \\
  alpine sh -c "cd /target && tar xzf /backup/pgdata-2025-10-09.tar.gz"

docker run --rm -v pgdata-restored:/data alpine ls /data`},
{h:'Copy a volume to another volume'},
{code:`docker run --rm -v old:/from:ro -v new:/to alpine sh -c "cp -a /from/. /to/"`},
{h:'Migrate to another host'},
{code:`# Stream through SSH without an intermediate file
docker run --rm -v pgdata:/source:ro alpine tar cz -C /source . \\
 | ssh user@newhost "docker run --rm -i -v pgdata:/target alpine tar xz -C /target"

# Or copy the backup file with scp and restore on the new host
scp pgdata-2025-10-09.tar.gz user@newhost:/tmp/`},
{h:'Consistency: the important warning'},
{note:'Copying the files of a **running database** can produce a corrupt, inconsistent backup. For databases use the database own tool for a logical dump, or stop the container before a file-level backup.'},
{code:`# Logical dump while the database runs (PostgreSQL)
docker exec db pg_dump -U postgres appdb > appdb.sql
# Restore into a new container
docker exec -i db2 psql -U postgres appdb < appdb.sql

# File-level backup: stop for a consistent copy
docker stop db
docker run --rm -v pgdata:/source:ro -v "$PWD":/backup alpine tar czf /backup/pgdata.tar.gz -C /source .
docker start db`},
{h:'Backup checklist'},
{t:[['Question','Good practice'],
['How often?','Automate with cron or CI; match how much data loss is acceptable'],
['Where is it stored?','Off the host (object storage, another server)'],
['Is it tested?','Restore regularly into a throw-away volume'],
['Is it consistent?','Dump databases or stop the container'],
['Is it protected?','Encrypt and restrict access']]},
{ul:['Use `docker volume inspect` to confirm the volume name before you back up.','Keep the volume names in your Compose project; the real name is prefixed by the project (for example `shop_pgdata`).','Docker Desktop can also export and import volumes from its dashboard.']}],
src:[['Back up, restore, or migrate volumes',S+'volumes/#back-up-restore-or-migrate-data-volumes']]};

/* ---------- 6: practical ---------- */
L['docker:6:6']={blocks:[
{p:'**Goal:** run PostgreSQL with its data on a **volume**, delete the container, create a new one on the same volume and prove the data survived. Then back it up and restore it.'},
{flow:['Create a named volume and start PostgreSQL on it','Create a table and a row','Remove the container (not the volume)','Start a new container on the same volume','Prove the data is still there','Back up and restore into a new volume']},
{h:'Step 1: start the database'},
{code:`docker volume create pgdata
docker run -d --name db1 \\
  -e POSTGRES_PASSWORD=pw -e POSTGRES_DB=shop \\
  -v pgdata:/var/lib/postgresql/data \\
  postgres:16
docker logs -f db1          # wait for "database system is ready to accept connections", Ctrl+C`},
{h:'Step 2: write data'},
{code:`docker exec db1 psql -U postgres -d shop -c "CREATE TABLE items(id serial, name text);"
docker exec db1 psql -U postgres -d shop -c "INSERT INTO items(name) VALUES ('apple'),('pear');"
docker exec db1 psql -U postgres -d shop -c "SELECT * FROM items;"`},
{h:'Step 3: destroy the container'},
{code:`docker rm -f db1
docker ps -a                       # db1 is gone
docker volume ls                   # pgdata is still here`},
{h:'Step 4: a new container, the same data'},
{code:`docker run -d --name db2 \\
  -e POSTGRES_PASSWORD=pw \\
  -v pgdata:/var/lib/postgresql/data \\
  postgres:16
sleep 5
docker exec db2 psql -U postgres -d shop -c "SELECT * FROM items;"     # apple and pear are back`},
{note:'The image only initialises a new database when the data folder is empty. Because the volume already has data, the container starts with your existing shop database.'},
{h:'Step 5: back up and restore'},
{code:`docker exec db2 pg_dump -U postgres shop > shop.sql
wc -l shop.sql

docker run -d --name db3 -e POSTGRES_PASSWORD=pw -v pgdata3:/var/lib/postgresql/data postgres:16
sleep 5
docker exec db3 psql -U postgres -c "CREATE DATABASE shop;"
docker exec -i db3 psql -U postgres -d shop < shop.sql
docker exec db3 psql -U postgres -d shop -c "SELECT count(*) FROM items;"    # 2`},
{h:'Step 6: compare with no volume (the failure case)'},
{code:`docker run -d --name tmpdb -e POSTGRES_PASSWORD=pw --mount type=tmpfs,dst=/var/lib/postgresql/data postgres:16
# data is in RAM only: removing or restarting the container loses it
docker rm -f tmpdb`},
{h:'Checkpoints'},
{t:[['Check','Expected'],
['After `docker rm -f db1`','Volume `pgdata` still listed'],
['Query in `db2`','Rows `apple` and `pear`'],
['`shop.sql` size','A few lines of SQL'],
['Query in `db3`','`count` = 2']]},
{h:'Cleanup'},
{code:`docker rm -f db2 db3
docker volume rm pgdata pgdata3
rm shop.sql`},
{h:'Stretch goals'},
{ul:['Run `docker volume inspect pgdata` and look at the Mountpoint.','Back up `pgdata` with the helper-container tar method (stop the database first).','Mount the volume read-only in a second container and observe the error when writing.']}],
src:[['Volumes',S+'volumes/'],['PostgreSQL official image','https://hub.docker.com/_/postgres']]};
})();
