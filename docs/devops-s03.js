/* LearnSphere - DevOps & CI/CD, Section 03: Git & Version Control Workflows.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const objects=K.dg(700,220,[
[10,10,680,200,'Commits are snapshots linked to parents',1],
[30,90,90,50,'C1',0],[160,90,90,50,'C2',0],[290,90,90,50,'C3',0],[420,90,90,50,'C4',0],
[420,40,90,36,'main (branch)',2],[275,160,120,36,'feature (branch)',0],[550,90,110,50,'HEAD|current commit',0]],
[[160,115,120,115],[290,115,250,115],[420,115,380,115],[465,76,465,90],[335,160,335,140],[550,115,510,115]]);

const loop=K.dg(700,200,[
[10,10,680,180,'The daily loop',1],
[25,70,100,60,'git pull',0],[155,70,100,60,'git switch -c|feature',0],[285,70,100,60,'edit and|git commit',0],[415,70,100,60,'git push',0],[545,70,130,60,'Pull request,|checks, merge',2]],
[[125,100,155,100],[255,100,285,100],[385,100,415,100],[515,100,545,100]]);

const mergeVsRebase=K.dg(700,260,[
[10,10,680,115,'Merge: keeps both lines and adds a merge commit',1],
[30,55,70,40,'A',0],[130,55,70,40,'B',0],[230,55,70,40,'D',0],
[330,55,70,40,'M',2],
[10,135,680,115,'Rebase: replays your commits on top of main, history is linear',1],
[30,180,70,40,'A',0],[130,180,70,40,'B',0],[230,180,70,40,'D',0],[330,180,70,40,'E',0],[430,180,240,40,'your commits become copies',0]],
[[100,75,130,75],[200,75,230,75],[300,75,330,75],[100,200,130,200],[200,200,230,200],[300,200,330,200],[400,200,430,200]]);

const flows=K.dg(700,240,[
[10,10,680,220,'Branching strategies compared by branch lifetime',1],
[30,60,200,50,'Trunk-based: hours to a day',2],
[250,60,200,50,'GitHub Flow: a day or few',0],
[470,60,200,50,'GitFlow: days to weeks',0],
[30,140,200,60,'Integrates constantly,|release from main|with flags',0],
[250,140,200,60,'Simple, deploy from|main after review',0],
[470,140,200,60,'Develop, release and|hotfix branches,|slower integration',0]],
[[130,110,130,140],[350,110,350,140],[570,110,570,140]]);

/* ---------- 0 ---------- */
L['devops:2:0']={blocks:[
{p:'Git stores a project as a **graph of snapshots**. Understanding that one idea makes branching, merging, rebasing and rollback predictable.'},
{svg:objects},
{h:'The core objects'},
{t:[['Object','What it is'],
['**Commit**','A snapshot of the whole project plus a message, an author and a pointer to its parent commit(s)'],
['**Branch**','A movable pointer to a commit. Creating a branch is just creating a pointer, so it is instant'],
['**Tag**','A fixed pointer to a commit, used to mark releases'],
['**HEAD**','A pointer to what you currently have checked out'],
['**Remote**','Another copy of the repository, such as `origin` on GitHub']]},
{h:'Why this matters for delivery'},
{ul:['A commit is identified by a **SHA** that depends on its content and parents. The same SHA always means exactly the same code, so pipelines can reference it safely.','Branches are cheap, so work can be isolated and integrated often.','Rolling back means pointing at an earlier commit, not undoing files by hand.']},
{code:`git log --oneline --graph --decorate   # see the graph
git show HEAD                           # what the current commit changed
git rev-parse HEAD                      # the full SHA`}],
src:[['Pro Git: Git objects','https://git-scm.com/book/en/v2/Git-Internals-Git-Objects']]};

/* ---------- 1 ---------- */
L['devops:2:1']={blocks:[
{p:'Most day-to-day work is one small loop. Learn it well, and keep branches short so that each trip around the loop is small.'},
{svg:loop},
{code:`git switch main
git pull                          # bring in teammates' work
git switch -c feature/add-health  # new branch

# edit files
git status
git add src/health.js tests/health.test.js
git commit -m "Add health endpoint"

git push -u origin feature/add-health
# open a pull request, wait for checks and review, then merge`},
{h:'Useful commands'},
{t:[['Goal','Command'],
['See what changed','`git status`, `git diff`'],
['Stage part of a file','`git add -p`'],
['Fix the last commit message','`git commit --amend`'],
['Undo a commit safely on a shared branch','`git revert <sha>`'],
['Discard local edits to a file','`git restore <file>`'],
['Save work in progress','`git stash`']]},
{note:'Never rewrite history that others have already pulled. `git revert` adds a new commit that undoes a change, which is safe on shared branches.'}],
src:[['Git documentation',K.GIT]]};

/* ---------- 2 ---------- */
L['devops:2:2']={blocks:[
{p:'There are three ways to combine a branch into another, and each leaves a different history.'},
{svg:mergeVsRebase},
{t:[['Method','History result','Strengths','Cost'],
['**Merge commit**','Keeps both lines with a merge commit','Preserves exact history, safe','Busier history'],
['**Squash and merge**','One commit per pull request on main','Clean main, easy revert of a whole change','Loses intermediate commits'],
['**Rebase and merge**','Linear, commits replayed on main','Straight history, easy bisect','Rewrites commits, new SHAs']]},
{h:'Rebasing your own branch'},
{code:`git fetch origin
git rebase origin/main     # replay your commits on the latest main
# resolve conflicts, then
git rebase --continue
git push --force-with-lease   # only your own branch, safer than --force`},
{h:'Choosing'},
{ul:['Pick **one** method per repository and enforce it in repository settings so history is predictable.','Squash is common for application repositories with small pull requests.','Never rebase a branch other people have based work on.']},
{note:'`--force-with-lease` refuses to overwrite commits you have not seen. Prefer it over `--force` whenever you must push rewritten history to your own branch.'}],
src:[['Pro Git: Rebasing','https://git-scm.com/book/en/v2/Git-Branching-Rebasing']]};

/* ---------- 3 ---------- */
L['devops:2:3']={blocks:[
{p:'A **branching strategy** is a team agreement on how branches are used. It directly sets how often code is integrated and how releases are produced, so it shapes the pipeline.'},
{svg:flows},
{t:[['Strategy','How it works','Best fit'],
['**Trunk-based development**','Everyone commits to main, or to very short-lived branches, many times a day; unfinished work hides behind feature flags','Teams practising continuous delivery with strong tests'],
['**GitHub Flow**','Branch from main, open a pull request, merge to main, deploy','Web services released continuously'],
['**GitFlow**','Long-lived `develop` plus release and hotfix branches','Versioned products with several supported releases']]},
{h:'What research says'},
{p:'The DORA research links **trunk-based development** and frequent integration to higher delivery performance. Long-lived branches increase merge pain and delay feedback.'},
{h:'Effect on the pipeline'},
{ul:['Trunk-based and GitHub Flow need a pipeline fast enough to run on every pull request.','GitFlow needs pipelines for several long-lived branches and a way to promote release branches.','Whatever you choose, main must always be in a releasable state.']}],
src:[['Trunk Based Development','https://trunkbaseddevelopment.com/'],['DORA: trunk-based development',K.DORA+'capabilities/trunk-based-development/']]};

/* ---------- 4 ---------- */
L['devops:2:4']={blocks:[
{p:'A **pull request** (GitHub) or **merge request** (GitLab) proposes a change and is the single place where human review and automated checks meet. Nothing reaches the main branch without passing through it.'},
{flow:['Push a branch','Open the pull request','Automated checks run (build, tests, scans)','Reviewers comment and approve','All required checks and approvals satisfied','Merge']},
{h:'Two kinds of gate'},
{t:[['Gate','What it answers','Who decides'],
['Status checks','Does it build, pass tests and meet policy?','The pipeline'],
['Review approvals','Is it correct, clear and a good design?','People']]},
{h:'Good pull requests'},
{ul:['Small: ideally under a few hundred changed lines, one purpose.','Described: why the change exists, how it was tested and how to roll it back.','Linked to the work item or incident.','Quick to review: reviewers respond within hours, not days (review wait is often the biggest queue).']},
{h:'Required checks'},
{p:'A status check only protects you if it is **required**. A failing check that is merely informational can be merged over.'},
{note:'Treat review time as part of lead time. If pull requests wait days for a reviewer, no faster pipeline will help.'}],
src:[['About pull requests',K.GHD+'pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests'],['Merge requests',K.GLD+'user/project/merge_requests/']]};

/* ---------- 5 ---------- */
L['devops:2:5']={blocks:[
{p:'Review and checks only matter if they **cannot be bypassed**. Branch protection (GitHub) and protected branches (GitLab) enforce the rules in the platform itself.'},
{t:[['Rule','Effect'],
['Require a pull request before merging','No direct pushes to main'],
['Require approvals','At least N reviewers must approve'],
['Require status checks to pass','Named pipeline jobs must succeed'],
['Require branches to be up to date','The branch includes the latest main before merging'],
['Require signed commits or linear history','Stricter integrity and history rules'],
['Block force pushes and deletions','History of main cannot be rewritten'],
['Do not allow bypass','Even administrators follow the rules']]},
{h:'Rulesets'},
{p:'GitHub **rulesets** let you apply rules across many branches, tags and repositories, and layer them (for example organisation-wide rules plus repository rules). They show clearly who may bypass and are the modern replacement for older per-branch protection.'},
{h:'CODEOWNERS'},
{p:'A `CODEOWNERS` file maps paths to people or teams. When a pull request touches those paths, the owners are requested automatically and can be **required** to approve.'},
{code:`# .github/CODEOWNERS
*                    @acme/developers
/.github/workflows/  @acme/platform-team
/deploy/             @acme/sre
/docs/               @acme/tech-writers`},
{note:'Protect the pipeline definitions themselves with CODEOWNERS. Otherwise anyone who can edit the workflow file can change what the checks verify.'}],
src:[['Rulesets',K.GHD+'repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets'],['About code owners',K.GHD+'repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners']]};

/* ---------- 6 ---------- */
L['devops:2:6']={blocks:[
{p:'A **tag** names a specific commit as a release. A **release** (on GitHub or GitLab) wraps a tag with notes and attached artifacts. A **version number** tells users how big the change is.'},
{h:'Semantic versioning'},
{t:[['Part','Increment when','Example'],
['**MAJOR**','You make an incompatible change','1.4.2 to 2.0.0'],
['**MINOR**','You add functionality in a compatible way','1.4.2 to 1.5.0'],
['**PATCH**','You make a compatible bug fix','1.4.2 to 1.4.3']]},
{p:'A pre-release is written `1.5.0-rc.1`. Build metadata follows a plus sign, such as `1.5.0+build.7`.'},
{h:'Tagging in practice'},
{code:`git tag -a v1.5.0 -m "Release 1.5.0"
git push origin v1.5.0

# Pipelines commonly trigger a release job on version tags
# GitHub Actions:  on: push: tags: ['v*']`},
{ul:['Use **annotated** tags for releases. They carry author, date and message.','Make tags **immutable** by convention and by protection rules. Do not move a published tag.','Record the tag and the commit SHA with every published artifact so you can trace production back to code.']},
{note:'Applications that are deployed continuously often use the commit SHA or a build number as the version. Semantic versioning is most useful for libraries and software consumed by others.'}],
src:[['Semantic Versioning','https://semver.org/']]};

/* ---------- 7 ---------- */
L['devops:2:7']={blocks:[
{p:'**Conventional Commits** is a lightweight message format. Because the messages are structured, tools can decide the next version number and write release notes without a person doing it.'},
{code:`<type>[optional scope]: <description>

[optional body]

[optional footer, e.g. BREAKING CHANGE: ...]`},
{t:[['Type','Meaning','Version effect'],
['`fix`','Bug fix','PATCH'],
['`feat`','New feature','MINOR'],
['`feat!` or `BREAKING CHANGE:`','Incompatible change','MAJOR'],
['`docs`, `chore`, `refactor`, `test`, `ci`','No behaviour change for users','None']]},
{code:`feat(api): add health endpoint
fix(auth): reject expired tokens
feat(db)!: drop legacy users table

BREAKING CHANGE: the users table no longer exists`},
{h:'What it gives you'},
{flow:['Developers write structured commit messages','A commit lint check enforces the format on pull requests','A release tool reads commits since the last tag','It computes the next version and generates the changelog','It tags and publishes the release']},
{p:'Tools such as `semantic-release`, `release-please` and `git-cliff` implement this flow. With squash merging, the **pull request title** becomes the commit message, so enforce the format on titles.'}],
src:[['Conventional Commits','https://www.conventionalcommits.org/']]};

/* ---------- 8 ---------- */
L['devops:2:8']={blocks:[
{p:'In this practical you make it impossible to change main without review and passing checks, then prove it by merging a change through a pull request.'},
{flow:['Create a repository from the sample app','Add a minimal CI workflow that runs the tests','Create a ruleset or branch protection for main','Try to push directly and confirm it is rejected','Open a pull request from a feature branch','Watch the check run, request review, then merge']},
{h:'Settings to configure'},
{t:[['Setting','Value'],
['Require a pull request','On, with 1 approval'],
['Require status checks','The test job, required and up to date'],
['Block force pushes','On'],
['Do not allow bypass','On (include administrators)'],
['Merge method','Squash only']]},
{h:'Prove it'},
{code:`git switch main
echo "x" >> README.md
git commit -am "direct change"
git push origin main     # should be rejected

git switch -c feature/readme-fix
# make a real change, commit, push, open a PR`},
{h:'Check yourself'},
{ul:['Can you merge while the test check is failing?','Can you merge your own change without approval?','What happens if main moved after you opened the PR?']},
{note:'A rule you cannot test is a rule you do not have. Always try the forbidden action once and confirm the platform blocks it.'}]};
})();
