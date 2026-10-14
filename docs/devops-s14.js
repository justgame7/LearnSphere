/* LearnSphere - DevOps & CI/CD, Section 14: Software Supply Chain Security & DevSecOps.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs devops-common.js. */
(function(){
const K=window.DO,L=window.LESSONS;

const shift=K.dg(700,220,[
[10,10,680,200,'Security checks along the path',1],
[25,70,100,60,'IDE and|pre-commit|secrets, lint',0],[145,70,100,60,'Pull request|SAST, SCA,|secrets',0],[265,70,100,60,'Build|SBOM, image|scan, IaC scan',2],[385,70,100,60,'Release|sign, attest',0],[505,70,80,60,'Deploy|policy',0],[600,70,75,60,'Runtime|monitor',0]],
[[125,100,145,100],[245,100,265,100],[365,100,385,100],[485,100,505,100],[585,100,600,100]]);

const attack=K.dg(700,260,[
[10,10,680,240,'Where attackers can get in',1],
[30,50,120,50,'Source|stolen credentials',0],[180,50,120,50,'Dependencies|malicious package',0],[330,50,120,50,'Build|poisoned workflow',0],[480,50,120,50,'Runners|reused host',0],
[30,150,120,50,'Registry|swapped image',0],[180,150,120,50,'Secrets|leaked token',0],[330,150,120,50,'Deploy|unverified artifact',0],[480,150,120,50,'People|phished maintainer',0]],
[]);

const sign=K.dg(700,220,[
[10,10,680,200,'Keyless signing with Sigstore',1],
[25,70,110,60,'CI job proves|identity (OIDC)',0],[170,70,110,60,'Fulcio issues|short-lived cert',2],[315,70,110,60,'cosign signs|the digest',0],[460,70,110,60,'Rekor records|in public log',0],[600,70,75,60,'Verify at|deploy',0]],
[[135,100,170,100],[280,100,315,100],[425,100,460,100],[570,100,600,100]]);

/* ---------- 0 ---------- */
L['devops:13:0']={blocks:[
{p:'**Shift left** means finding problems earlier, where they are cheaper to fix. Each type of check has a natural place in the pipeline.'},
{svg:shift},
{t:[['Check','Finds','Best placed','Owner of the fix'],
['Secret scanning','Committed credentials','Pre-commit, push protection, pull request','Author, then security rotates'],
['SCA (dependency scanning)','Vulnerable or malicious libraries','Pull request and scheduled','Author or dependency bot'],
['SAST','Flaws in your own code','Pull request','Author'],
['IaC scanning','Misconfigured infrastructure','Pull request','Author or platform team'],
['Image scanning','Vulnerabilities in the built image','After build, before push','Author, with base image owners'],
['DAST','Flaws in a running app','Against a test environment','Author, security triage'],
['Runtime monitoring','Active attacks and drift','Production','Operations and security']]},
{h:'Decide ownership'},
{ul:['Findings must go to a person who can fix them, in the tool they already use (the pull request).','Distinguish **blocking** findings (critical, exploitable) from **informational** ones.','Track a baseline so the pipeline fails on **new** problems, not the inherited backlog.']},
{note:'Shift left does not mean moving all work to developers. It means giving fast, relevant feedback at the point of change, while security still owns policy and triage.'}],
src:[['OWASP Top 10 CI/CD risks',K.OWASP]]};

/* ---------- 1 ---------- */
L['devops:13:1']={blocks:[
{p:'A pipeline can reach source code, secrets, registries and production, so it is an attractive target. **Threat modelling** asks: what are we protecting, who might attack it and how?'},
{svg:attack},
{t:[['Risk area','Example attack','Defence'],
['Source','Stolen maintainer credentials push malicious code','MFA, branch protection, signed commits, review'],
['Dependencies','A typosquatted or hijacked package','Lock files, scanning, internal proxy, minimal dependencies'],
['Build definition','A pull request alters the workflow to exfiltrate secrets','CODEOWNERS on pipelines, no secrets for untrusted code'],
['Runners','A reused self-hosted runner leaks previous job data','Ephemeral runners, isolation'],
['Credentials','A long-lived token in logs is reused','OIDC, short lifetime, scoping, rotation'],
['Artifacts','A tampered image is deployed','Signing, provenance, verify at admission'],
['Third-party actions','A compromised action runs with your secrets','Pin to SHA, allow list, least privilege']]},
{h:'A simple method'},
{flow:['List assets: source, secrets, artifacts, production access','Draw the pipeline and trust boundaries','For each step ask how it could be abused','Rank by likelihood and impact','Add controls and test that they work']},
{note:'The OWASP Top 10 CI/CD Security Risks is a useful checklist to compare against your pipeline.'}],
src:[['OWASP CI/CD Top 10',K.OWASP]]};

/* ---------- 2 ---------- */
L['devops:13:2']={blocks:[
{p:'A leaked secret is exploited quickly. **Secret scanning** detects credentials in code, and **push protection** blocks them before they reach the repository.'},
{t:[['Control','Stage','What it does'],
['Pre-commit hook (gitleaks, detect-secrets)','On the developer machine','Blocks the commit locally'],
['**Push protection**','On push to the platform','Rejects a push containing a known secret pattern'],
['Repository scanning','After the fact, including history','Finds secrets that already got in'],
['Provider partnership alerts','Platform side','Notifies the issuer so a leaked token is revoked automatically']]},
{code:`# gitleaks in a pipeline
gitleaks detect --source . --redact --exit-code 1`},
{h:'When a secret is found'},
{flow:['Revoke or rotate the secret immediately','Check access logs for use of the credential','Remove it from the code and replace with a secret reference','Optionally rewrite history, but treat the secret as compromised regardless','Add a test or rule so it cannot recur']},
{note:'Deleting the commit does not make the secret safe. Forks, clones and caches may already hold it. **Revoke first.**'}],
src:[['GitHub secret scanning',K.GHD+'code-security/secret-scanning/introduction/about-secret-scanning'],['Gitleaks','https://github.com/gitleaks/gitleaks']]};

/* ---------- 3 ---------- */
L['devops:13:3']={blocks:[
{p:'Most of your code is **other people\'s code**. **Software composition analysis (SCA)** lists your dependencies and matches them against vulnerability databases, and bots keep them updated.'},
{t:[['Tool kind','Examples','Does'],
['Scanner','Dependabot alerts, OSV-Scanner, Trivy, Snyk, `npm audit`, `pip-audit`','Reports known vulnerable versions'],
['Update bot','Dependabot, Renovate','Opens pull requests for new versions'],
['License check','FOSSA, ScanCode','Flags incompatible licences']]},
{code:`# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    open-pull-requests-limit: 5
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }`},
{h:'Reading findings'},
{ul:['**Reachability** matters: is the vulnerable function actually used?','Use severity plus **exploitability** (such as EPSS or known-exploited lists), not CVSS alone.','Prefer upgrading to fixing by exception, and document exceptions with an expiry.','Watch for **malicious** packages (typosquatting) as well as vulnerable ones.']},
{note:'Small, frequent dependency updates are far easier than a once-a-year upgrade. Automating updates is itself a security control.'}],
src:[['Dependabot',K.GHD+'code-security/dependabot'],['OSV','https://osv.dev/']]};

/* ---------- 4 ---------- */
L['devops:13:4']={blocks:[
{p:'**SAST** analyses your source for insecure patterns without running it. **DAST** attacks a running application from the outside. They find different problems.'},
{t:[['','SAST','DAST'],
['Needs','Source code','A running deployment'],
['Finds','Injection patterns, unsafe functions, hard-coded secrets, logic flaws','Misconfigurations, missing headers, runtime injection, auth issues'],
['When','Every pull request','Against a test environment, nightly or per release'],
['Speed','Minutes','Minutes to hours'],
['Weakness','False positives, language coverage','Limited coverage of internal logic']]},
{h:'Tools'},
{ul:['**SAST**: CodeQL, Semgrep, SonarQube, language-specific analysers.','**DAST**: OWASP ZAP, Burp Suite, Nuclei.','**IAST/RASP** add instrumentation inside the running app (not covered here).']},
{h:'Tune to be useful'},
{flow:['Start with a small, high-confidence rule set','Run on pull requests and show results inline','Triage false positives and suppress with a reason','Measure time to fix and the false positive rate','Expand rules as the team keeps pace']},
{note:'A scanner nobody trusts gets ignored. Start narrow with rules that rarely lie, then widen.'}],
src:[['CodeQL',K.GHD+'code-security/code-scanning/introduction-to-code-scanning/about-code-scanning'],['OWASP ZAP','https://www.zaproxy.org/docs/']]};

/* ---------- 5 ---------- */
L['devops:13:5']={blocks:[
{p:'Container images and infrastructure code can be scanned before they are deployed.'},
{t:[['Scanner','Scans','Notes'],
['**Trivy**','Images, filesystems, IaC, SBOMs, secrets','All-in-one open source scanner'],
['**Grype**','Images and SBOMs for vulnerabilities','Pairs with Syft for SBOMs'],
['**Checkov**','Terraform, Kubernetes, CloudFormation, Dockerfiles','Policy-based IaC checks'],
['**tfsec / trivy config**','Terraform','Static checks for misconfiguration']]},
{code:`# Fail the build on high or critical issues that have a fix
trivy image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 ghcr.io/acme/app:\${GIT_SHA}

# Scan infrastructure code
checkov -d infra/ --quiet --compact`},
{h:'Setting thresholds'},
{ul:['Gate on **fixable** high and critical issues to start. Unfixable findings cannot be acted upon.','Keep a reviewed **ignore file** with reasons and expiry dates.','Scan **again on a schedule**. New vulnerabilities appear after you built the image.','Reduce findings at the source: smaller base images, fewer packages.']},
{note:'Scanning the image in the pipeline only tells you the state today. Registries and clusters should rescan stored images so new CVEs reach you.'}],
src:[['Trivy','https://trivy.dev/latest/docs/'],['Checkov','https://www.checkov.io/']]};

/* ---------- 6 ---------- */
L['devops:13:6']={blocks:[
{p:'A **software bill of materials (SBOM)** is a machine-readable inventory of the components in a piece of software. When a new vulnerability such as Log4Shell appears, the SBOM lets you answer **what is affected** in minutes.'},
{t:[['Format','Notes'],
['**SPDX**','ISO standard (ISO/IEC 5962), strong on licences and provenance'],
['**CycloneDX**','OWASP standard, designed for security use cases']]},
{code:`# Generate an SBOM for an image
syft ghcr.io/acme/app:1.4.2 -o spdx-json > sbom.spdx.json
trivy image --format cyclonedx ghcr.io/acme/app:1.4.2 > sbom.cdx.json

# Use it later to check for newly published vulnerabilities
grype sbom:./sbom.spdx.json`},
{flow:['Generate the SBOM in the build','Attach it to the image as an attestation','Store it in a searchable place','A new CVE is published','Query SBOMs to find affected applications']},
{h:'Practical points'},
{ul:['Generate from the **built artifact**, not only the source, so transitive and OS packages are included.','Keep an SBOM per released version.','Consumers can request SBOMs from vendors as part of procurement.']}],
src:[['SPDX','https://spdx.dev/'],['CycloneDX','https://cyclonedx.org/'],['Syft','https://github.com/anchore/syft']]};

/* ---------- 7 ---------- */
L['devops:13:7']={blocks:[
{p:'**Signing** proves who produced an artifact and that it was not changed. **Sigstore** provides free, open tooling, and **keyless signing** avoids managing private keys.'},
{svg:sign},
{t:[['Component','Role'],
['**cosign**','Sign and verify container images and other artifacts'],
['**Fulcio**','Certificate authority that issues short-lived certificates tied to an OIDC identity'],
['**Rekor**','Public transparency log recording signatures'],
['**Policy controller / admission**','Reject unsigned or untrusted images in the cluster']]},
{code:`# Sign by digest in a GitHub Actions job that has id-token: write
cosign sign --yes ghcr.io/acme/app@sha256:ab12...

# Verify that it was signed by this workflow in this repository
cosign verify ghcr.io/acme/app@sha256:ab12... \\
  --certificate-identity-regexp 'https://github.com/acme/app/.github/workflows/release.yml@refs/heads/main' \\
  --certificate-oidc-issuer https://token.actions.githubusercontent.com`},
{h:'Rules'},
{ul:['Sign the **digest**, never a tag.','Verify **identity**, not only that a signature exists: who signed it, from which workflow.','Enforce verification at deploy time (admission controller), otherwise signing changes nothing.']}],
src:[['Sigstore',K.SIG],['cosign',K.SIG+'cosign/signing/overview/']]};

/* ---------- 8 ---------- */
L['devops:13:8']={blocks:[
{p:'**Provenance** is signed metadata saying **how** an artifact was built: which source, which builder, which steps. **SLSA** (Supply-chain Levels for Software Artifacts) defines increasing assurance levels for build integrity.'},
{t:[['Build level','Meaning'],
['**Build L1**','Provenance exists (documentation of how it was built)'],
['**Build L2**','Hosted build platform generates signed provenance'],
['**Build L3**','Hardened build platform; provenance cannot be forged by the build itself and builds are isolated']]},
{code:`# Attach provenance with the GitHub attestation action
- uses: actions/attest-build-provenance@v2
  with:
    subject-name: ghcr.io/acme/app
    subject-digest: \${{ steps.push.outputs.digest }}
    push-to-registry: true`},
{h:'Limits to remember'},
{ul:['Provenance proves **where and how** it was built, not that the **code is safe**. A malicious commit built on a perfect pipeline has valid provenance.','It only helps if consumers **verify** it and compare it to expectations (source repository, builder identity).','Source and dependency integrity are separate concerns from build integrity.']},
{note:'Treat SLSA as a way to raise the cost of tampering, one level at a time, not as a guarantee of safety.'}],
src:[['SLSA',K.SLSA+'spec/v1.0/levels'],['GitHub artifact attestations',K.GHD+'actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds']]};

/* ---------- 9 ---------- */
L['devops:13:9']={blocks:[
{p:'Extend the sample pipeline with four controls and then verify each from the outside.'},
{flow:['Scan the image and fail on fixable high or critical issues','Generate an SBOM and attach it','Sign the image digest with cosign (keyless)','Generate build provenance','Verify signature and provenance before deploy']},
{code:`jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
      attestations: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: \${{ github.actor }}, password: \${{ secrets.GITHUB_TOKEN }} }
      - id: build
        uses: docker/build-push-action@v6
        with:
          push: true
          tags: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
      - uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: ghcr.io/\${{ github.repository }}@\${{ steps.build.outputs.digest }}
          severity: HIGH,CRITICAL
          ignore-unfixed: true
          exit-code: '1'
      - uses: sigstore/cosign-installer@v3
      - run: cosign sign --yes ghcr.io/\${{ github.repository }}@\${{ steps.build.outputs.digest }}
      - uses: actions/attest-build-provenance@v2
        with:
          subject-name: ghcr.io/\${{ github.repository }}
          subject-digest: \${{ steps.build.outputs.digest }}
          push-to-registry: true`},
{h:'Verify'},
{code:`cosign verify ghcr.io/<owner>/<repo>@sha256:<digest> \\
  --certificate-identity-regexp '^https://github.com/<owner>/<repo>/' \\
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
gh attestation verify oci://ghcr.io/<owner>/<repo>@sha256:<digest> --owner <owner>`},
{ul:['Does an unsigned image get refused by a policy test?','Which workflow identity appears in the signature?','Where is the SBOM stored?']}]};
})();
