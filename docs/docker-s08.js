/* LearnSphere - Docker, Section 08: Docker Compose.
   Lectures 0-8 are core, 9-14 are additional content (not written yet). Needs docker-common.js.
   Note: a literal dollar-brace in code blocks is written with a backslash before the dollar. */
(function(){
const K=window.DK,L=window.LESSONS,E=K.E,R=K.R,C=K.C;

/* ---------- diagrams ---------- */
const concept=K.dg(700,230,[
[10,10,680,210,'Project: shop (one compose.yaml)',1],
[30,50,170,56,'service: web|image / build, ports|environment',2],[250,50,170,56,'service: db|image: postgres|volume: pgdata',0],[470,50,200,56,'service: cache|image: redis',0],
[30,140,640,50,'Network shop_default: all services can reach each other by service name',0]],
[[115,106,115,140],[335,106,335,140],[570,106,570,140]]);

const dep=K.dg(700,170,[
[10,60,130,50,'db|starting',0],[190,60,140,50,'db|healthy',2],[380,60,130,50,'app|starts',2],[560,60,130,50,'app|serving',0]],
[[140,85,190,85],[330,85,380,85],[510,85,560,85]]);

/* ---------- 0: concepts ---------- */
L['docker:7:0']={blocks:[
{p:'Running one container is one `docker run`. A real application has several: a web server, a database, a cache. Typing several long `docker run` commands is slow and error-prone. **Docker Compose** lets you describe the whole application in **one YAML file** and start it with **one command**.'},
{svg:concept},
{h:'Key terms'},
{t:[['Term','Meaning'],
['**Compose file**','`compose.yaml`: describes services, networks and volumes'],
['**Compose Specification**','The open standard that defines the file format'],
['**Service**','One component, run as one or more containers from one image'],
['**Project**','A running instance of a Compose application, with a name (default: the folder name)'],
['**Compose plugin**','The `docker compose` command (version 2). Older `docker-compose` (with a hyphen) is the legacy Python tool']]},
{h:'From docker run to Compose'},
{code:`# Without Compose
docker network create shop
docker volume create pgdata
docker run -d --name db --network shop -v pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=pw postgres:16
docker run -d --name web --network shop -p 8080:80 nginx:1.27`},
{code:`# compose.yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pw
    volumes:
      - pgdata:/var/lib/postgresql/data
  web:
    image: nginx:1.27
    ports:
      - "8080:80"

volumes:
  pgdata:`},
{code:`docker compose up -d        # create network, volume, containers
docker compose ps
docker compose down         # remove containers and network (volume kept)`},
{h:'Why use Compose'},
{ul:['**One file, one command:** the whole stack is documented and reproducible.','**Version control:** the file lives next to your code.','**Names and networks for free:** Compose creates a network and every service is reachable by its service name.','**Environments:** override files change settings for development and production.']},
{h:'The obsolete version field'},
{p:'Old files started with `version: "3.8"`. The current Compose Specification **ignores** it and prints a warning. **Delete the `version:` line** from new files.'},
{h:'File names'},
{t:[['Name','Status'],
['`compose.yaml`','Preferred'],
['`compose.yml`','Supported'],
['`docker-compose.yaml` / `docker-compose.yml`','Still supported for compatibility']]},
{h:'What Compose is and is not'},
{t:[['Good for','Not designed for'],
['Local development','Large clusters across many machines'],
['Tests and CI','Automatic rescheduling on node failure'],
['Small single-host production','Rolling updates over many nodes']]},
{p:'For multi-host production use Swarm (Section 10) or Kubernetes. Compose files can also be deployed as Swarm stacks.'}],
src:[['Compose overview',C],['Compose Specification','https://compose-spec.io/'],['Why use Compose',C+'intro/features-uses/']]};

/* ---------- 1: compose.yaml structure ---------- */
L['docker:7:1']={blocks:[
{p:'A Compose file has a few **top-level sections**. Services are the heart; networks and volumes are declared once and used by name.'},
{t:[['Top-level key','Purpose'],
['`name`','Optional project name'],
['`services`','The containers to run (**required**)'],
['`networks`','Networks to create'],
['`volumes`','Named volumes to create'],
['`configs`, `secrets`','Configuration and sensitive data to mount'],
['`include`','Pull in other Compose files']]},
{h:'A complete example'},
{code:`name: shop

services:
  web:
    build:
      context: ./web          # build from a Dockerfile
      args:
        APP_VERSION: "1.0"
    image: shop-web:1.0       # name for the built image
    ports:
      - "8080:8000"           # host:container
    environment:
      DB_HOST: db
    depends_on:
      - db
    networks: [front, back]
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pw
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks: [back]

networks:
  front:
  back:
    internal: true

volumes:
  pgdata:`},
{h:'The most used service keys'},
{t:[['Key','Same as docker run','Example'],
['`image`','image argument','`image: redis:7`'],
['`build`','docker build','`build: ./app`'],
['`command`','command after image','`command: ["python","app.py"]`'],
['`entrypoint`','`--entrypoint`','`entrypoint: ["/start.sh"]`'],
['`ports`','`-p`','`- "8080:80"`'],
['`expose`','EXPOSE (internal only)','`- "9000"`'],
['`environment`, `env_file`','`-e`, `--env-file`','see lecture 4'],
['`volumes`','`-v`, `--mount`','`- data:/var/lib/x`'],
['`networks`','`--network`','`[front, back]`'],
['`restart`','`--restart`','`unless-stopped`'],
['`healthcheck`','`--health-*`','see lecture 5'],
['`depends_on`','(startup order)','see lecture 5'],
['`deploy.resources`','`-m`, `--cpus`','limits under `deploy`'],
['`user`, `working_dir`','`-u`, `-w`','`user: "10001"`'],
['`read_only`, `tmpfs`, `cap_drop`','`--read-only`, `--tmpfs`, `--cap-drop`','hardening']]},
{h:'Project naming: why resources have long names'},
{p:'Compose prefixes everything with the **project name** so two projects never collide. The project name is the folder name unless you set `name:`, `-p`, or `COMPOSE_PROJECT_NAME`.'},
{t:[['Resource','Name pattern','Example'],
['Container','`project-service-N`','`shop-web-1`'],
['Default network','`project_default`','`shop_default`'],
['Named volume','`project_volume`','`shop_pgdata`'],
['Built image','`project-service`','`shop-web`']]},
{code:`docker compose -p shop-test up -d      # a second copy of the same stack under another name
docker compose ls                       # list running projects
docker volume ls | grep shop`},
{h:'Networks in Compose'},
{ul:['If you declare none, Compose creates **one default network** and all services join it; they find each other by **service name** (`db`, `web`).','Declare networks to separate tiers, exactly like Section 6.','Use `external: true` to join a network that already exists.']},
{h:'Validate your file'},
{code:`docker compose config           # prints the final merged and interpolated file, or the error
docker compose config --services
docker compose config -q        # quiet: only report errors`},
{note:'YAML uses **spaces** for indentation (never tabs). Quote ports like `"8080:80"`, because unquoted `80:80` can be read as a number in base 60 by some parsers.'}],
src:[['Compose file reference',R+'compose-file/'],['Services',R+'compose-file/services/'],['Project name',C+'how-tos/project-name/']]};

/* ---------- 2: CLI ---------- */
L['docker:7:2']={blocks:[
{p:'Run these commands from the folder that contains `compose.yaml` (or pass `-f file`). They act on the whole project.'},
{t:[['Command','What it does'],
['`docker compose up`','Create (if needed) and start everything; stays attached and shows logs'],
['`docker compose up -d`','Same, in the background'],
['`docker compose up --build`','Rebuild images first'],
['`docker compose up --wait`','Wait until services are running and healthy'],
['`docker compose ps`','List the project containers and their state'],
['`docker compose logs -f web`','Follow the logs of one service'],
['`docker compose exec web sh`','Run a command in a running service container'],
['`docker compose run --rm web pytest`','Start a **new** one-off container for a service'],
['`docker compose build`','Build images for services with `build:`'],
['`docker compose pull`','Pull the latest images'],
['`docker compose top`','Processes of each service'],
['`docker compose config`','Show the resolved file'],
['`docker compose down`','Stop and remove containers and networks']]},
{h:'stop, down and down -v: the difference'},
{t:[['Command','Containers','Networks','Volumes','Images'],
['`docker compose stop`','Stopped, kept','Kept','Kept','Kept'],
['`docker compose down`','**Removed**','**Removed**','Kept','Kept'],
['`docker compose down -v`','Removed','Removed','**Removed (data lost)**','Kept'],
['`docker compose down --rmi all`','Removed','Removed','Kept','Removed']]},
{note:'`down -v` deletes your named volumes, including database data. Use it for throw-away environments, not for anything you care about.'},
{h:'Typical day'},
{code:`docker compose up -d --build         # start or update the stack
docker compose ps
docker compose logs -f --tail 50 web  # watch the application
docker compose exec db psql -U postgres
docker compose restart web            # restart one service
docker compose up -d --no-deps web    # recreate only web, not its dependencies
docker compose stop                   # pause the whole stack
docker compose down                   # tear it down (data volumes kept)`},
{h:'What `up` decides'},
{flow:['Compose reads and merges the file(s) and builds the plan','Missing images are pulled or built','Networks and volumes are created if they do not exist','Containers are created, or recreated if their configuration or image changed','Unchanged containers are left running']},
{h:'Useful options'},
{t:[['Option','Meaning'],
['`--force-recreate`','Recreate containers even if nothing changed'],
['`--no-recreate`','Never recreate existing containers'],
['`--remove-orphans`','Remove containers of services no longer in the file'],
['`--scale web=3`','Run three containers of a service (do not publish a fixed host port!)'],
['`-f a.yaml -f b.yaml`','Merge several files'],
['`-p name`','Choose the project name'],
['`--profile debug`','Enable a profile'],
['`--env-file file`','Use a different .env file']]},
{h:'Troubleshooting'},
{ul:['**`no configuration file provided`**: you are in the wrong folder, or the file name is wrong.','**`port is already allocated`**: another container or program uses that host port.','**A change in the file did not apply**: run `docker compose up -d` again (Compose recreates what changed).','**A code change in the image did not apply**: add `--build`.','**Old containers hang around**: use `--remove-orphans`.']}],
src:[['Compose CLI reference',R+'cli/docker/compose/'],['docker compose up',R+'cli/docker/compose/up/'],['docker compose down',R+'cli/docker/compose/down/']]};

/* ---------- 3: environment variables ---------- */
L['docker:7:3']={blocks:[
{p:'Compose uses variables in **two different ways**, and mixing them up is the most common confusion:'},
{t:[['Use','Where the value is used','Syntax'],
['**Interpolation**','Inside the **Compose file** itself, before containers exist','`image: postgres:${PG_VERSION}`'],
['**Container environment**','Passed to the **running container** as environment variables','`environment:` or `env_file:`']]},
{h:'Container environment'},
{code:`services:
  app:
    image: myapp
    environment:
      LOG_LEVEL: debug              # map style
      DB_HOST: db
    # or list style:
    # environment:
    #   - LOG_LEVEL=debug
    env_file:
      - ./common.env
      - ./app.env                    # later files override earlier ones`},
{h:'Interpolation and the .env file'},
{p:'A file called **`.env`** next to `compose.yaml` is read automatically. Its values are available for **interpolation** in the Compose file.'},
{code:`# .env
PG_VERSION=16
APP_PORT=8080

# compose.yaml
services:
  db:
    image: postgres:\${PG_VERSION}
  web:
    image: nginx
    ports:
      - "\${APP_PORT}:80"`},
{t:[['Syntax','Meaning'],
['`\${VAR}` or `$VAR`','Value of VAR (empty and a warning if unset)'],
['`\${VAR:-default}`','`default` if VAR is unset **or empty**'],
['`\${VAR-default}`','`default` only if VAR is unset'],
['`\${VAR:?message}`','**Fail** with the message if VAR is unset or empty'],
['`\${VAR:+value}`','`value` if VAR is set and not empty'],
['`$$`','A literal dollar sign']]},
{code:`services:
  db:
    image: postgres:\${PG_VERSION:-16}
    environment:
      POSTGRES_PASSWORD: \${DB_PASSWORD:?DB_PASSWORD is required}`},
{note:'`.env` is **not automatically passed into containers**. It feeds interpolation. To pass a value to a container, name it in `environment:` (for example `environment: [DB_HOST]`) or use `env_file:`.'},
{h:'Precedence: which value wins?'},
{p:'For a variable inside a **container**, from highest to lowest priority:'},
{flow:['docker compose run -e VAR=value on the command line','environment: or env_file: values (including those interpolated from your shell)','The environment: attribute written with a fixed value','The env_file: attribute','ENV in the image (Dockerfile)']},
{p:'For **interpolation** in the Compose file, a variable in your **shell environment** beats values in the `.env` file, and `--env-file` replaces the default `.env`.'},
{code:`PG_VERSION=15 docker compose up -d       # shell value wins over .env
docker compose --env-file prod.env up -d  # use a different file
docker compose config | grep image        # see the final result`},
{h:'Good practice'},
{ul:['Commit a `.env.example` with fake values; keep real `.env` out of Git (add it to `.gitignore`).','Never put production secrets in `.env` committed to a repository. Use secrets (lecture 8).','Always run `docker compose config` when something looks wrong.','In a file where you need a literal `$`, write `$$`.']}],
src:[['Environment variables in Compose',C+'how-tos/environment-variables/'],['Interpolation',C+'how-tos/environment-variables/variable-interpolation/'],['Precedence',C+'how-tos/environment-variables/envvars-precedence/']]};

/* ---------- 4: startup order and health ---------- */
L['docker:7:4']={blocks:[
{p:'An application often fails at start because its database is **running but not ready** yet. Compose can order startup and even wait for readiness. The key idea: **started is not the same as ready.**'},
{svg:dep},
{h:'depends_on'},
{t:[['Form','Behaviour'],
['`depends_on: [db]`','Start `db` before `app`. Does **not** wait for readiness.'],
['`condition: service_started`','Same as above (default).'],
['`condition: service_healthy`','Wait until `db` is **healthy** (its health check passes).'],
['`condition: service_completed_successfully`','Wait until a one-off service (migration, init) has **exited with 0**.']]},
{code:`services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: pw
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  migrate:
    image: myapp
    command: ["python", "manage.py", "migrate"]
    depends_on:
      db:
        condition: service_healthy

  app:
    image: myapp
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully`},
{h:'Health check keys'},
{t:[['Key','Meaning'],
['`test`','The command: `["CMD", ...]` or `["CMD-SHELL", "..."]`'],
['`interval`','Time between checks (default 30s)'],
['`timeout`','A check slower than this fails'],
['`retries`','Failures in a row before unhealthy'],
['`start_period`','Grace time during start-up'],
['`disable: true`','Disable a health check from the image']]},
{h:'Wait from the command line'},
{code:`docker compose up -d --wait        # returns when services are running/healthy; fails otherwise
docker compose ps                   # STATUS shows (healthy)`},
{h:'Why you still need retry logic in the app'},
{ul:['A dependency can restart or become unavailable **after** startup.','Health checks reduce start-up races; they do not remove the need for **reconnect and retry** code.','Keep checks cheap and meaningful (`pg_isready`, `redis-cli ping`, an HTTP `/health` endpoint).']},
{h:'Restart and dependencies'},
{ul:['`restart: unless-stopped` brings failed services back.','`depends_on` applies on `docker compose up`; it does not restart a service when a dependency restarts (use `restart: true` under `depends_on` to propagate restarts: `db: {condition: service_healthy, restart: true}`).']},
{h:'Diagnose a start-up problem'},
{code:`docker compose ps -a
docker compose logs db app
docker inspect --format '{{json .State.Health}}' shop-db-1`}],
src:[['Control startup and shutdown order',C+'how-tos/startup-order/'],['depends_on',R+'compose-file/services/#depends_on'],['healthcheck',R+'compose-file/services/#healthcheck']]};

/* ---------- 5: profiles and multiple files ---------- */
L['docker:7:5']={blocks:[
{p:'One file rarely fits every situation: development wants live code and debug tools, production wants pinned images and no extras. Compose gives you three tools: **profiles**, **multiple files** and **include**.'},
{h:'Profiles: optional services'},
{p:'A service with a `profiles:` list starts **only when that profile is enabled**. Services without profiles always start.'},
{code:`services:
  web:
    image: myapp
  db:
    image: postgres:16
  adminer:                 # a DB admin tool, only when asked for
    image: adminer
    profiles: ["debug"]
    ports: ["8081:8080"]
  seed:
    image: myapp
    command: ["python", "seed.py"]
    profiles: ["tools"]`},
{code:`docker compose up -d                       # web and db only
docker compose --profile debug up -d       # plus adminer
COMPOSE_PROFILES=debug,tools docker compose up -d
docker compose run --rm seed                # running a profile service by name works without enabling the profile`},
{h:'Multiple files: merge'},
{p:'`compose.yaml` plus an automatic **`compose.override.yaml`** in the same folder are merged, so you can keep production-safe defaults in the base file and developer conveniences in the override.'},
{code:`# compose.yaml (base)
services:
  web:
    image: myapp:1.0
    restart: unless-stopped

# compose.override.yaml (read automatically for local development)
services:
  web:
    build: .
    ports: ["8000:8000"]
    environment:
      DEBUG: "1"`},
{code:`docker compose up -d                                   # base + override (development)
docker compose -f compose.yaml -f compose.prod.yaml up -d   # explicit: base + prod, no override
docker compose -f compose.yaml -f compose.prod.yaml config   # inspect the merge result`},
{h:'Merge rules'},
{t:[['Type of value','What happens when files are merged'],
['Single values (`image`, `command`)','The **later** file replaces the earlier'],
['Mappings (`environment`, `labels`)','Merged key by key; later wins on the same key'],
['Lists such as `ports`, `volumes`','**Combined** (both are kept)'],
['`!reset` tag','Empty the value from the earlier file'],
['`!override` tag','Replace instead of merge']]},
{h:'extends: reuse one service'},
{code:`# common.yaml
services:
  base-app:
    image: myapp
    environment: { LOG_LEVEL: info }

# compose.yaml
services:
  web:
    extends:
      file: common.yaml
      service: base-app
    ports: ["8080:80"]`},
{h:'include: build a big app from pieces'},
{code:`include:
  - ./database/compose.yaml
  - path: ./monitoring/compose.yaml
    env_file: ./monitoring/.env

services:
  web:
    image: myapp
    depends_on: [db]        # db is defined in the included file`},
{t:[['Tool','Best for'],
['Profiles','Optional services in the same project (debug tools, jobs)'],
['Override files','Different settings per environment'],
['extends','Sharing one service definition'],
['include','Splitting a large application across teams or folders']]},
{note:'Always run `docker compose config` after merging. It prints exactly what will run.'}],
src:[['Using profiles',C+'how-tos/profiles/'],['Merge Compose files',C+'how-tos/multiple-compose-files/merge/'],['Include',C+'how-tos/multiple-compose-files/include/'],['Extend',C+'how-tos/multiple-compose-files/extends/']]};

/* ---------- 6: Compose Watch ---------- */
L['docker:7:6']={blocks:[
{p:'During development you edit code constantly. **Compose Watch** monitors your files and automatically updates the running containers, so you do not rebuild by hand. You choose, per path, **what to do** when a file changes.'},
{t:[['Action','What happens','Use for'],
['`sync`','Copy the changed file into the container','Interpreted code with live reload (Python, Node.js dev servers)'],
['`rebuild`','Rebuild the image and recreate the container','Dependency files (`package.json`, `requirements.txt`) and compiled code'],
['`sync+restart`','Copy the file, then restart the container','Config changes that the app reads only at start'],
['`sync+exec`','Copy, then run a command in the container','Reload hooks']]},
{code:`services:
  web:
    build: .
    ports: ["8000:8000"]
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
          ignore:
            - "**/__pycache__"
        - action: rebuild
          path: ./requirements.txt
        - action: sync+restart
          path: ./config.yaml
          target: /app/config.yaml`},
{code:`docker compose up --watch          # start the stack and watch
docker compose watch               # attach watch to an already running stack
# edit src/app.py -> it is copied into the container within a second`},
{h:'Watch versus a bind mount'},
{t:[['','Bind mount','Compose Watch'],
['How files reach the container','Same folder, live','Copied (sync) or rebuilt'],
['Speed on Docker Desktop','Can be slow across the VM','Fast: only changed files are copied'],
['Host and container dependencies','Share one folder: host `node_modules` may leak in','Container keeps its own dependencies'],
['Rebuild on dependency change','Manual','Automatic with `rebuild`'],
['Good for','Simple setups','Cross-platform teams, big projects']]},
{h:'Tips'},
{ul:['Put `.dockerignore`-style patterns under `ignore:` for folders that should not sync (`node_modules`, `.git`).','The watched path is relative to the Compose file; the `target` is the path inside the container.','The service needs a Dockerfile (`build:`) to use `rebuild`.','Watch is a **development** tool. Do not use it in production.']},
{flow:['Edit a source file on your computer','Compose Watch detects the change','The matching rule runs: sync, rebuild or restart','The container reflects your change']}],
src:[['Use Compose Watch',C+'how-tos/file-watch/'],['develop specification',R+'compose-file/develop/']]};

/* ---------- 7: secrets and configs ---------- */
L['docker:7:7']={blocks:[
{p:'Passwords and keys should not be written in the Compose file, in `environment:` or in an image. Compose offers two safer mechanisms that mount data **as files**:'},
{t:[['','Secrets','Configs'],
['For','Sensitive data (passwords, tokens, keys)','Non-sensitive configuration files'],
['Mounted at','`/run/secrets/<name>` (read-only)','`/<name>` or a path you choose'],
['Source','A file, or an environment variable','A file, environment variable or inline content']]},
{h:'Secrets from a file'},
{code:`services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt     # keep this file out of Git`},
{code:`mkdir -p secrets && printf "s3cr3t" > secrets/db_password.txt
echo "secrets/" >> .gitignore
docker compose up -d db
docker compose exec db cat /run/secrets/db_password     # s3cr3t (inside the container only)
docker inspect shop-db-1 | grep -i password             # not shown in the container environment`},
{note:'Many official images support the **`_FILE` convention**: set `POSTGRES_PASSWORD_FILE` (or `MYSQL_ROOT_PASSWORD_FILE`) to a path, and the image reads the secret from that file instead of an environment variable.'},
{h:'Secrets from an environment variable'},
{code:`secrets:
  api_token:
    environment: API_TOKEN       # taken from the shell or .env on the host`},
{h:'Configs'},
{code:`services:
  web:
    image: nginx:1.27
    configs:
      - source: nginx_conf
        target: /etc/nginx/conf.d/default.conf
        mode: 0440

configs:
  nginx_conf:
    file: ./nginx/default.conf`},
{h:'Why not just use environment variables?'},
{t:[['Environment variable','Secret file'],
['Visible in `docker inspect` and process listings','Not in the container config'],
['Inherited by child processes and often printed in crash dumps','Read only when the app opens the file'],
['Easy to log by mistake','Not logged unless your app prints it']]},
{h:'Limits of Compose secrets'},
{ul:['On a single host the secret is a **bind-mounted file**; anyone with access to the host files can read it. It is better than environment variables, but not a vault.','For stronger protection use **Swarm secrets** (encrypted, Section 10), a cloud secret manager or a tool such as Vault.','Never commit secret files.']},
{h:'Checklist'},
{flow:['Put the secret in a file outside Git','Declare it under secrets: at the top level','Attach it to the services that need it','Make the application read the file path (or use the _FILE variable)','Verify with docker inspect that the value is not in the environment']}],
src:[['Secrets in Compose',C+'how-tos/use-secrets/'],['secrets reference',R+'compose-file/secrets/'],['configs reference',R+'compose-file/configs/']]};

/* ---------- 8: practical ---------- */
L['docker:7:8']={blocks:[
{p:'**Goal:** build a three-service stack: a Python web app, a PostgreSQL database and a Redis cache. Use a custom network, a volume, health checks and `depends_on`, a secret for the password, and an environment-specific override file.'},
{svg:K.dg(700,200,[
[10,70,130,56,'You|localhost:8000',0],[190,60,150,76,'web (Flask)|build: ./web',2],[400,10,150,56,'db (Postgres)|volume + secret|healthcheck',0],[400,130,150,56,'cache (Redis)|healthcheck',0],[600,70,90,56,'volume|pgdata',0]],
[[140,98,190,98],[340,80,400,45],[340,115,400,155],[550,38,600,85]])},
{h:'Step 1: project files'},
{code:`mkdir shop && cd shop && mkdir web secrets
printf "pw12345" > secrets/db_password.txt
printf "secrets/\\n.env\\n" > .gitignore

cat > web/requirements.txt <<'EOF'
flask==3.0.3
redis==5.0.8
psycopg2-binary==2.9.9
EOF

cat > web/app.py <<'EOF'
import os, redis, psycopg2
from flask import Flask
app = Flask(__name__)
r = redis.Redis(host=os.environ["REDIS_HOST"])

def db():
    pw = open("/run/secrets/db_password").read().strip()
    return psycopg2.connect(host=os.environ["DB_HOST"], user="postgres", password=pw, dbname="postgres")

@app.get("/")
def hit():
    n = r.incr("hits")
    with db() as c, c.cursor() as cur:
        cur.execute("CREATE TABLE IF NOT EXISTS visits(id serial, at timestamptz default now())")
        cur.execute("INSERT INTO visits DEFAULT VALUES")
        cur.execute("SELECT count(*) FROM visits")
        total = cur.fetchone()[0]
    return f"cache hits: {n}, rows in db: {total}\\n"

@app.get("/health")
def health():
    return "ok\\n"
EOF

cat > web/Dockerfile <<'EOF'
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
RUN useradd -r -u 10001 app
USER 10001
CMD ["flask", "--app", "app", "run", "--host", "0.0.0.0", "--port", "8000"]
EOF`},
{h:'Step 2: compose.yaml (base)'},
{code:`cat > compose.yaml <<'EOF'
name: shop

services:
  web:
    build: ./web
    environment:
      DB_HOST: db
      REDIS_HOST: cache
    secrets: [db_password]
    depends_on:
      db:
        condition: service_healthy
      cache:
        condition: service_healthy
    networks: [front, back]
    restart: unless-stopped

  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 10
    networks: [back]

  cache:
    image: redis:7
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 10
    networks: [back]

networks:
  front:
  back:
    internal: true

volumes:
  pgdata:

secrets:
  db_password:
    file: ./secrets/db_password.txt
EOF`},
{h:'Step 3: the development override'},
{code:`cat > compose.override.yaml <<'EOF'
services:
  web:
    ports:
      - "8000:8000"
    environment:
      FLASK_DEBUG: "1"
    develop:
      watch:
        - action: sync+restart
          path: ./web/app.py
          target: /app/app.py
        - action: rebuild
          path: ./web/requirements.txt
EOF
docker compose config | head -40         # see the merged result`},
{h:'Step 4: run and test'},
{code:`docker compose up -d --build --wait
docker compose ps                         # all (healthy)
curl http://localhost:8000/               # cache hits: 1, rows in db: 1
curl http://localhost:8000/               # cache hits: 2, rows in db: 2
docker compose logs --tail 5 web
docker compose exec db psql -U postgres -c "SELECT count(*) FROM visits;"`},
{h:'Step 5: prove persistence and isolation'},
{code:`docker compose down                       # containers and networks removed
docker compose up -d --wait
curl http://localhost:8000/               # rows in db continue (volume survived); cache restarts from 1
nc -zv localhost 5432 || echo "db not published (good)"
docker compose exec cache redis-cli ping
docker compose exec web env | grep -i password || echo "no password in the environment (good)"`},
{h:'Step 6: a production-like file'},
{code:`cat > compose.prod.yaml <<'EOF'
services:
  web:
    image: shop-web:1.0
    ports: !override
      - "80:8000"
EOF
docker compose -f compose.yaml -f compose.prod.yaml config | grep -A2 ports    # no override file, port 80`},
{h:'Checkpoints'},
{t:[['Check','Expected'],
['`docker compose ps`','web, db, cache; db and cache `healthy`'],
['Two requests to `/`','Counters increase'],
['After `down` and `up`','DB rows continue; Redis counter restarts'],
['`nc localhost 5432`','Not reachable'],
['Password in container env','Absent (it is a secret file)']]},
{h:'Cleanup'},
{code:`docker compose down -v          # also removes the pgdata volume
cd .. && rm -rf shop`},
{h:'Stretch goals'},
{ul:['Run `docker compose up --watch` and edit `app.py`.','Add a `debug` profile with Adminer.','Scale `web` to 3 containers behind a reverse proxy service.','Deploy the same file as a Swarm stack in Section 10.']}],
src:[['Compose quickstart',C+'gettingstarted/'],['Compose samples',C+'samples-for-compose/']]};
})();
