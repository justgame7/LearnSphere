/* LearnSphere - DevOps & CI/CD, Section 10: Testing & Quality Gates.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const pyramid=K.dg(700,260,[
[10,10,680,240,'Test pyramid',1],
[250,40,200,50,'End-to-end|few, slow, fragile',0],
[190,110,320,50,'Integration|some, services and databases',0],
[110,180,480,50,'Unit|many, fast, isolated',2]],
[]);

const gates=K.dg(700,200,[
[10,10,680,180,'Quality gates in order',1],
[25,70,100,60,'Lint and|format',0],[145,70,100,60,'Unit tests',0],[265,70,100,60,'Static|analysis',0],[385,70,100,60,'Coverage|threshold',0],[505,70,80,60,'Security|scan',0],[600,70,75,60,'Merge',2]],
[[125,100,145,100],[245,100,265,100],[365,100,385,100],[485,100,505,100],[585,100,600,100]]);

/* ---------- 0 ---------- */
L['devops:9:0']={blocks:[
{p:'Different tests answer different questions at different costs. The **test pyramid** says: have many cheap, fast tests at the bottom and few expensive, broad tests at the top.'},
{svg:pyramid},
{t:[['Level','Question','Speed','Where in the pipeline'],
['Unit','Does this piece of logic work?','Milliseconds','Every commit, first'],
['Integration','Do components work with real dependencies?','Seconds','Every pull request'],
['End-to-end','Does the whole user journey work?','Minutes','After deployment to a test environment'],
['Smoke','Is the deployed system alive?','Seconds','After every deployment']]},
{h:'Why the shape matters'},
{ul:['Fast tests give fast feedback, so developers run them.','Broad tests are slow, flaky and hard to diagnose. Keep them few and focused on critical journeys.','An **inverted pyramid** (mostly end-to-end tests) makes a slow, flaky pipeline.']},
{flow:['Static checks and unit tests (seconds)','Integration tests (minutes)','Build and package','Deploy to a test environment','End-to-end and smoke tests']}]};

/* ---------- 1 ---------- */
L['devops:9:1']={blocks:[
{p:'Integration tests need real services such as a database or message queue. Pipelines start them as **service containers**, so tests run against the real thing in a clean environment.'},
{code:`# GitHub Actions: PostgreSQL service for integration tests
jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/postgres`},
{t:[['Platform','Service containers'],
['GitHub Actions','`services:` on a job'],
['GitLab CI/CD','`services:` with an image alias'],
['Jenkins','Docker agents or Testcontainers in tests']]},
{h:'Good practice'},
{ul:['Wait for the service to be **healthy** before running tests.','Use the **same engine and major version** as production, not a lightweight substitute.','Isolate test data per test (transactions, unique schemas) so tests can run in parallel.','Libraries like Testcontainers start dependencies from test code itself.']}],
src:[['Service containers',K.GH+'use-cases-and-examples/using-containerized-services/about-service-containers']]};

/* ---------- 2 ---------- */
L['devops:9:2']={blocks:[
{p:'After a deployment you verify from the **outside**, the way a user or client would. Keep this layer small and reliable.'},
{t:[['Check','Purpose','Example'],
['**Smoke test**','Is it alive and wired correctly?','`GET /health` returns 200; login page loads'],
['**Synthetic transaction**','Does a critical path work?','Create an order and read it back'],
['**End-to-end test**','Does a full user journey work in a browser?','Sign up, search, check out']]},
{code:`# Smoke test script run after deploy
set -euo pipefail
URL="$1"
curl -fsS --retry 10 --retry-delay 3 --retry-all-errors "$URL/health" | grep -q '"status":"ok"'
curl -fsS "$URL/api/version" | tee version.json
test "$(jq -r .version version.json)" = "$EXPECTED_VERSION"`},
{h:'Keeping E2E tests useful'},
{ul:['Test only business-critical journeys, not every combination.','Use stable selectors and wait for conditions, not fixed sleeps.','Run against a dedicated environment with controlled test data.','Quarantine a flaky test immediately and fix it. A red pipeline that people ignore is worse than no test.']},
{note:'Have the smoke test confirm the **version** that is running. A health check that passes on the old version proves nothing about the new one.'}]};

/* ---------- 3 ---------- */
L['devops:9:3']={blocks:[
{p:'**Static analysis** inspects code without running it. **Linters** enforce style and catch common errors. **Quality platforms** such as SonarQube add rules for bugs, vulnerabilities and maintainability and track them over time.'},
{t:[['Tool kind','Examples','Finds'],
['Formatter','Prettier, gofmt, Black','Style differences, auto-fixable'],
['Linter','ESLint, Pylint, Ruff, golangci-lint','Likely bugs, unused code, bad patterns'],
['Type checker','TypeScript, mypy','Type errors'],
['Quality platform','SonarQube, SonarCloud','Bugs, code smells, security hotspots, duplication, trends']]},
{h:'Quality gates'},
{p:'A **quality gate** is a pass or fail rule on measured results, such as no new critical issues, coverage on new code above a threshold, duplication under a limit. Failing the gate fails the pipeline.'},
{svg:gates},
{h:'Make it adoptable'},
{ul:['Apply rules to **new code** first so a legacy codebase does not block everything.','Make formatting automatic, not a review topic.','Tune noisy rules. A rule people disable wholesale gives no value.','Run linters in the editor and as a pre-commit hook for fast feedback, and again in CI as the authority.']}],
src:[['SonarQube quality gates','https://docs.sonarsource.com/sonarqube-server/latest/instance-administration/analysis-functions/quality-gates/']]};

/* ---------- 4 ---------- */
L['devops:9:4']={blocks:[
{p:'**Code coverage** is the share of code executed by tests. It tells you what is **not** tested, but not whether tested code is **well** tested.'},
{t:[['Measure','Meaning'],
['Line coverage','Share of lines executed'],
['Branch coverage','Share of decision outcomes executed (stricter)'],
['Coverage on new code','Coverage of the lines changed in this pull request']]},
{h:'Using it well'},
{ul:['Gate on **new code** coverage (for example 80 percent), not total coverage. It rewards good behaviour now without punishing history.','Use a **floor** that must not drop, rather than a high target that invites gaming.','Look at **uncovered critical paths**, not only the percentage.','Pair with mutation testing or code review for test quality.']},
{h:'Gaming and its cost'},
{t:[['Behaviour','Result'],
['Tests with no assertions','High coverage, no safety'],
['Excluding files from coverage','A flattering number, real gaps'],
['Chasing 100 percent','Brittle tests of trivial code']]},
{note:'Goodhart\'s law applies: when a measure becomes a target, it stops being a good measure. Treat coverage as a signal that starts a conversation.'}]};

/* ---------- 5 ---------- */
L['devops:9:5']={blocks:[
{p:'Where do integration and end-to-end tests run? The three common models have different costs and risks.'},
{t:[['Type','Description','Strengths','Weaknesses'],
['**Ephemeral**','Created for one pipeline run or pull request, then destroyed','Clean, isolated, parallel','Setup time and cost'],
['**Preview**','Per pull request, kept while the PR is open','Reviewers and product can try the change','Needs automated cleanup'],
['**Shared**','One long-lived staging or QA environment','Cheap, close to production','Contention, drift, tests interfere']]},
{svg:K.dg(700,180,[
[10,10,680,160,'Preview environment lifecycle',1],
[30,60,130,60,'PR opened',0],[210,60,140,60,'Create namespace|and deploy',0],[400,60,120,60,'Test and review',2],[570,60,100,60,'PR closed:|destroy',0]],
[[160,90,210,90],[350,90,400,90],[520,90,570,90]])},
{h:'Practices'},
{ul:['Create environments from the **same definitions** as production (containers, manifests, infrastructure as code).','Tag environments with owner and expiry, and delete them automatically.','Use shared environments for the **last** checks only, and serialise access with queues or locks.','Seed predictable test data and reset it between runs.']}]};

/* ---------- 6 ---------- */
L['devops:9:6']={blocks:[
{p:'Tests need data, and schema changes need to be proven safe before they touch production data.'},
{h:'Test data'},
{t:[['Approach','Notes'],
['**Generated or fixture data**','Small, deterministic, created by the test. Best default'],
['**Seed scripts**','A known baseline loaded before tests'],
['**Production copy**','Realistic, but contains personal data. Needs masking and strict access'],
['**Synthetic generation**','Realistic shape and volume without real people']]},
{p:'Never use unmasked production personal data in lower environments. It widens who can see it and creates compliance risk.'},
{h:'Database migrations'},
{flow:['Write a versioned migration script (Flyway, Liquibase, Alembic, EF Migrations)','Apply it to an empty database in CI to prove it builds the schema','Apply it to a copy with realistic data and volume','Run the application tests against the migrated schema','Apply in production as part of a controlled deployment']},
{ul:['Make migrations **backward compatible** (expand, then contract) so old and new application versions both work during a rollout.','Test the rollback or roll-forward path.','Keep migrations small and idempotent.']},
{code:`# Example: run Flyway against a CI database
flyway -url=jdbc:postgresql://localhost:5432/app -user=app -password="$DB_PASS" migrate`}],
src:[['Flyway','https://documentation.red-gate.com/flyway'],['Liquibase','https://docs.liquibase.com/']]};

/* ---------- 7 ---------- */
L['devops:9:7']={blocks:[
{p:'Performance regressions are easy to introduce and hard to notice. A small **baseline test** in the pipeline catches big ones early without making every build slow.'},
{t:[['Test','Purpose','When'],
['**Micro-benchmark**','Time a critical function','Every pull request, with tolerance'],
['**Load test**','Behaviour at expected traffic','Nightly or before release'],
['**Stress test**','Find the breaking point','Periodically'],
['**Soak test**','Detect leaks over hours','Before major releases']]},
{code:`// k6 example: 20 virtual users for one minute with thresholds
import http from 'k6/http';
export const options = {
  vus: 20, duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<300'],   // 95% under 300 ms
    http_req_failed: ['rate<0.01'],     // under 1% errors
  },
};
export default function () { http.get('https://staging.example.com/api/items'); }`},
{h:'Principles'},
{ul:['Compare to a **baseline** from the same environment. Absolute numbers on shared runners are noisy.','Run against a stable, production-like test environment.','Fail only on meaningful regressions (thresholds with tolerance).','Run heavy tests on a schedule, and keep the pull request path fast.']}],
src:[['Grafana k6','https://grafana.com/docs/k6/latest/']]};

/* ---------- 8 ---------- */
L['devops:9:8']={blocks:[
{p:'Prove the gates work by committing a change that should be blocked, and watching it stop.'},
{flow:['Add lint, unit test, coverage and scan jobs and make them required','Create a branch with a lint error and a missing test','Open a pull request and confirm it is blocked','Fix one problem at a time and watch each gate pass','Merge only when every required check is green']},
{code:`# Gates as separate jobs in one workflow
jobs:
  lint:    { runs-on: ubuntu-latest, steps: [{ uses: actions/checkout@v4 }, { run: npm ci }, { run: npm run lint }] }
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test -- --coverage
      - name: Enforce coverage on all code
        run: npx --yes nyc check-coverage --lines 80
  gate:
    needs: [lint, test]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - run: test "\${{ needs.lint.result }}" = success -a "\${{ needs.test.result }}" = success`},
{h:'Make one final required check'},
{p:'Require a single aggregate job (`gate`) in branch protection. Adding or renaming jobs then does not require changing the protection rules, and skipped jobs do not leave a check pending.'},
{h:'Check yourself'},
{ul:['Which gate failed first and how quickly?','Can a failing check be bypassed? It should not be.','What would a flaky test do to this process?']}]};
})();
