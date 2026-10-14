/* LearnSphere - DevOps & CI/CD, Section 08: Jenkins.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const arch=K.dg(700,240,[
[10,10,680,220,'Jenkins architecture',1],
[25,70,150,90,'Controller|UI, scheduling,|config, plugins',2],
[240,30,170,40,'Agent: Linux (SSH)',0],[240,90,170,40,'Agent: Docker container',0],[240,150,170,40,'Agent: Kubernetes pod',0],
[480,60,190,100,'Each agent has|executors that run|one build each',0]],
[[175,115,240,50],[175,115,240,110],[175,115,240,170],[410,110,480,110]]);

const flow=K.dg(700,200,[
[10,10,680,180,'Multibranch pipeline',1],
[25,70,120,60,'Repository|webhook',0],[185,70,130,60,'Scan branches|and PRs',2],[355,30,140,40,'Job: main',0],[355,90,140,40,'Job: feature-x',0],[355,150,140,30,'Job: PR-42',0],[540,70,130,60,'Jenkinsfile|per branch',0]],
[[145,100,185,100],[315,100,355,50],[315,100,355,110],[315,100,355,165],[495,110,540,100]]);

/* ---------- 0 ---------- */
L['devops:7:0']={blocks:[
{p:'**Jenkins** is an open source automation server. A **controller** holds configuration, the web interface and the scheduler. **Agents** (formerly called nodes or slaves) do the work, each with one or more **executors**.'},
{svg:arch},
{t:[['Part','Role'],
['**Controller**','Stores jobs, credentials and settings; decides what runs where. Should not run builds'],
['**Agent**','A machine or container that runs build steps, connected to the controller'],
['**Executor**','A slot on an agent that runs one build at a time'],
['**Plugin**','An extension that adds features: SCM, build tools, credentials types, UI']]},
{h:'Plugins define Jenkins'},
{p:'The core is small. Source control integration, Docker, Kubernetes, credential stores and most pipeline steps come from plugins. That gives great flexibility, and also means plugin quality, compatibility and security updates are a core part of running Jenkins.'},
{h:'Where Jenkins fits'},
{ul:['Strong when you need deep customisation, many integrations or full control of where builds run.','You operate it yourself: upgrades, backups, plugin hygiene and capacity are your responsibility.','Pipelines are written in Groovy-based syntax in a `Jenkinsfile`.']}],
src:[['Jenkins architecture',K.JK+'book/scaling/architecting-for-scale/'],['Jenkins documentation',K.JK]]};

/* ---------- 1 ---------- */
L['devops:7:1']={blocks:[
{p:'Jenkins is a Java application. It needs a supported **Java runtime**, which is the most common installation problem.'},
{t:[['Topic','Guidance'],
['Java version','Use a Java version that your Jenkins release supports. Current releases require a recent LTS such as Java 21, with Java 25 supported on newer lines. Check the current requirements in the Jenkins documentation'],
['Release line','Choose **LTS** for production (stable, selected every few months) or weekly for newest features'],
['Install methods','Native packages, container image, WAR file, Kubernetes with Helm']]},
{h:'Run it in a container'},
{code:`docker run -d --name jenkins \\
  -p 8080:8080 -p 50000:50000 \\
  -v jenkins_home:/var/jenkins_home \\
  jenkins/jenkins:lts-jdk21

docker logs jenkins        # contains the initial admin password`},
{flow:['Start Jenkins','Unlock with the initial admin password','Install suggested plugins (or select your own)','Create the first admin user','Set the Jenkins URL','Start creating pipelines']},
{h:'The home directory'},
{p:'`JENKINS_HOME` (`/var/jenkins_home` in the image) holds everything: job definitions, credentials, plugins and build records. **Back it up** and keep it on persistent storage.'},
{note:'Put Jenkins behind HTTPS (a reverse proxy) before exposing it, and do not expose port 50000 or the UI to the internet without strong authentication.'}],
src:[['Installing Jenkins',K.JK+'book/installing/'],['Java requirements',K.JK+'book/platform-information/support-policy-java/']]};

/* ---------- 2 ---------- */
L['devops:7:2']={blocks:[
{p:'Jenkins has two ways to define a job. **Freestyle** jobs are configured by clicking in the UI. **Pipeline** jobs are defined as code in a `Jenkinsfile`.'},
{t:[['','Freestyle','Pipeline'],
['Defined in','UI form fields','Jenkinsfile in the repository'],
['Version control','No (can be exported)','Yes, with the code'],
['Multiple stages and logic','Awkward chains of jobs','Native stages, conditions, parallelism'],
['Survives controller restart','Limited','Yes, can resume'],
['Reuse','Copy the job','Shared libraries']]},
{h:'Why pipelines replaced freestyle'},
{ul:['Reviewable: a change to the build is a pull request.','Reproducible: the pipeline is recreated from the repository.','Expressive: parallelism, retries, conditions and post actions.']},
{h:'Migrating a freestyle job'},
{flow:['List what the job does: SCM, triggers, build steps, post steps','Write the same steps in a Jenkinsfile','Run both in parallel and compare results','Retire the freestyle job']},
{note:'Many Jenkins instances carry hundreds of old freestyle jobs. Inventory them first. Unused jobs are a maintenance and security cost.'}],
src:[['Pipeline',K.JK+'book/pipeline/']]};

/* ---------- 3 ---------- */
L['devops:7:3']={blocks:[
{p:'A **declarative pipeline** has a fixed, readable structure: where to run (`agent`), what to do (`stages` and `steps`) and what to do afterwards (`post`).'},
{code:`pipeline {
  agent any
  options {
    timeout(time: 20, unit: 'MINUTES')
    disableConcurrentBuilds()
  }
  environment {
    APP_ENV = 'ci'
  }
  stages {
    stage('Build') {
      steps {
        sh 'npm ci'
        sh 'npm run build'
      }
    }
    stage('Test') {
      steps { sh 'npm test' }
      post { always { junit 'reports/junit.xml' } }
    }
    stage('Deploy') {
      when { branch 'main' }
      steps { sh './deploy.sh staging' }
    }
  }
  post {
    failure { echo 'Build failed' }
    cleanup { cleanWs() }
  }
}`},
{t:[['Section','Purpose'],
['`agent`','Where the pipeline or a stage runs: `any`, `none`, a label, `docker`, `kubernetes`'],
['`options`','Timeouts, retention, concurrency'],
['`environment`','Environment variables, including credentials bindings'],
['`when`','Conditions for running a stage'],
['`parallel`','Run stages side by side'],
['`post`','Actions after: `always`, `success`, `failure`, `cleanup`']]},
{note:'Declarative syntax is preferred for most pipelines. Scripted pipelines (plain Groovy) give more freedom, but are harder to read and to keep consistent.'}],
src:[['Pipeline syntax',K.JK+'book/pipeline/syntax/']]};

/* ---------- 4 ---------- */
L['devops:7:4']={blocks:[
{p:'Builds need capacity. Jenkins agents come in several forms, and the trend is away from long-lived machines toward **ephemeral** ones created per build.'},
{t:[['Agent type','How it connects','Characteristics'],
['**Static, SSH**','Controller connects over SSH to a long-lived host','Simple. State accumulates, patching and drift are your problem'],
['**Inbound (JNLP/WebSocket)**','The agent connects out to the controller','Works through firewalls'],
['**Docker agent**','Container started per pipeline or stage','Clean, tool versions in the image'],
['**Kubernetes agent**','Pod created per build by the Kubernetes plugin','Elastic and ephemeral']]},
{code:`pipeline {
  agent none
  stages {
    stage('Build') {
      agent { docker { image 'node:22' } }
      steps { sh 'npm ci && npm test' }
    }
    stage('Package') {
      agent { label 'linux && docker' }
      steps { sh 'docker build -t app .' }
    }
  }
}`},
{h:'Guidelines'},
{ul:['Set the controller to **0 executors** so it never runs builds.','Use **labels** to match agents to jobs by capability.','Prefer containers and pods so each build starts from a known state.','Keep tool versions in the container image, not installed by hand on agents.']}],
src:[['Using agents',K.JK+'book/using/using-agents/'],['Pipeline agents',K.JK+'book/pipeline/syntax/#agent']]};

/* ---------- 5 ---------- */
L['devops:7:5']={blocks:[
{p:'Jenkins keeps secrets in its **Credentials** store, and pipelines bind them to variables only for the steps that need them.'},
{t:[['Credential kind','Use'],
['Secret text','Tokens and API keys'],
['Username with password','Registries and basic auth'],
['SSH username with private key','Git over SSH, remote hosts'],
['Secret file','Kubeconfig, certificates'],
['Certificate','Client certificates']]},
{code:`pipeline {
  agent any
  stages {
    stage('Push image') {
      steps {
        withCredentials([usernamePassword(
            credentialsId: 'registry-creds',
            usernameVariable: 'REG_USER',
            passwordVariable: 'REG_PASS')]) {
          sh 'echo "$REG_PASS" | docker login -u "$REG_USER" --password-stdin registry.example.com'
        }
      }
    }
  }
}`},
{h:'Protect secrets'},
{ul:['Use **single quotes** around `sh` commands so the shell, not Groovy, expands the variable. Groovy interpolation can leak the value into logs and process lists.','Jenkins masks bound credentials in logs, but a script can still transform them.','Scope credentials to folders so only the right jobs see them, and rotate them regularly.','Consider an external secret store (Vault) with a Jenkins plugin for dynamic credentials.']}],
src:[['Using credentials',K.JK+'book/using/using-credentials/']]};

/* ---------- 6 ---------- */
L['devops:7:6']={blocks:[
{p:'A **multibranch pipeline** scans a repository and creates a job for every branch and pull request that contains a `Jenkinsfile`. New branches get pipelines automatically, and deleted branches are cleaned up.'},
{svg:flow},
{h:'Webhooks beat polling'},
{t:[['Trigger','Behaviour','Cost'],
['**Polling SCM**','Jenkins asks the repository for changes on a schedule','Wasteful and delayed'],
['**Webhook**','The repository calls Jenkins when something changes','Instant and cheap']]},
{flow:['Add the repository as a branch source (GitHub, GitLab, Bitbucket or Git)','Configure credentials for read access','Set up a webhook from the host to Jenkins','Jenkins indexes branches and pull requests','A push triggers the matching branch job']},
{h:'Use branch logic'},
{code:`stage('Deploy') {
  when { branch 'main' }
  steps { sh './deploy.sh' }
}
stage('Preview') {
  when { changeRequest() }
  steps { sh './deploy-preview.sh' }
}`},
{note:'For pull requests from forks, configure trust so that only trusted contributors\' Jenkinsfile changes run with credentials.'}],
src:[['Multibranch pipeline',K.JK+'book/pipeline/multibranch/']]};

/* ---------- 7 ---------- */
L['devops:7:7']={blocks:[
{p:'Plugins are Jenkins\' greatest strength and its biggest operational risk. Each one adds code that runs inside the controller with broad access.'},
{h:'Evaluate before installing'},
{t:[['Check','Why'],
['Maintained recently and by a known maintainer','Abandoned plugins stop getting security fixes'],
['Listed security advisories','The Jenkins project publishes advisories per plugin'],
['Install count and community use','Widely used plugins are better reviewed'],
['Dependencies','Each dependency is another plugin to maintain'],
['Do you really need it?','A shell step in a pipeline is often enough']]},
{h:'Managing the set'},
{ul:['Keep a **list of plugins in code** (for example a `plugins.txt` used when building the controller image).','Update regularly and test updates on a staging controller first.','Remove unused and deprecated plugins.','Subscribe to the Jenkins security advisories.']},
{code:`# Install from a list while building a controller image
jenkins-plugin-cli --plugin-file /usr/share/jenkins/ref/plugins.txt`},
{note:'The Jenkins Update Center marks plugins with known vulnerabilities. Treat those warnings as work to schedule, not as noise.'}],
src:[['Managing plugins',K.JK+'book/managing/plugins/'],['Security advisories','https://www.jenkins.io/security/advisories/']]};

/* ---------- 8 ---------- */
L['devops:7:8']={blocks:[
{p:'A Jenkins controller is a high-value target: it stores credentials and can run arbitrary code on agents. Lock it down in layers.'},
{t:[['Area','Setting'],
['**Authentication**','Use your identity provider (SAML, OIDC, LDAP). Disable anonymous access'],
['**Authorization**','Role-based or matrix authorisation. Grant least privilege per folder'],
['**CSRF protection**','Keep it enabled so forged requests are rejected'],
['**Controller executors**','Set to 0 so builds never run on the controller'],
['**Agent isolation**','Agents cannot read controller files (agent-to-controller access control)'],
['**Script security**','Use the Script Security plugin sandbox for pipeline Groovy; review approvals'],
['**Network**','HTTPS, restrict agent ports, firewall the controller']]},
{h:'Reducing blast radius'},
{ul:['Use separate controllers for teams or environments rather than one controller for everything.','Run production-deploying jobs on dedicated agents with narrow network access.','Do not let developers edit the controller configuration. Manage it as code (Configuration as Code plugin).']},
{code:`# jenkins.yaml for Configuration as Code (excerpt)
jenkins:
  numExecutors: 0
  securityRealm:
    local:
      allowsSignup: false
  authorizationStrategy:
    roleBased: {}`}],
src:[['Securing Jenkins',K.JK+'book/system-administration/security/']]};

/* ---------- 9 ---------- */
L['devops:7:9']={blocks:[
{p:'Build the sample app on throwaway Docker agents using a multibranch pipeline.'},
{flow:['Run the Jenkins container with a persistent home volume','Install the Docker Pipeline and your SCM plugin','Set the controller to zero executors','Add a Docker-capable agent','Create the multibranch pipeline for the sample repository','Push a branch and a pull request, and watch jobs appear']},
{code:`// Jenkinsfile
pipeline {
  agent none
  options { timeout(time: 15, unit: 'MINUTES') }
  stages {
    stage('Test') {
      agent { docker { image 'node:22' } }
      steps {
        sh 'npm ci'
        sh 'npm test'
      }
    }
    stage('Build image') {
      agent { label 'docker' }
      steps {
        sh 'docker build -t sample-app:\${GIT_COMMIT} .'
      }
    }
    stage('Deploy staging') {
      when { branch 'main' }
      agent { label 'docker' }
      steps { sh './deploy.sh staging' }
    }
  }
  post { failure { echo 'Pipeline failed' } }
}`},
{h:'Verify'},
{ul:['Does each new branch get its own job?','Does the test stage run in a fresh container each time?','Does the deploy stage run only on main?','Is the controller executing any builds? It should not.']}]};
})();
