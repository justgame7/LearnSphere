/* LearnSphere - Google Cloud, Section 14: Security.
   Lectures 0-8 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const depth=K.dg(700,330,[
[10,10,680,310,'Defense in depth',1],
[30,45,640,40,'Identity and access: IAM, groups, MFA, least privilege',0],
[30,95,640,40,'Network: VPC design, firewall, private access, Cloud Armor, VPC Service Controls',0],
[30,145,640,40,'Compute and containers: hardened images, Shielded VMs, Binary Authorization, patching',0],
[30,195,640,40,'Data: encryption (KMS), Secret Manager, DLP, backups, retention',2],
[30,245,640,40,'Detect and respond: audit logs, Security Command Center, alerting, incident process',0]],
[]);

const kms=K.dg(700,230,[
[10,10,680,210,'Envelope encryption with Cloud KMS',1],
[30,80,130,60,'Your data|encrypted by DEK',0],[200,80,130,60,'DEK|data key',0],[370,80,140,60,'KEK in Cloud KMS|key encryption key',2],[550,80,120,60,'HSM or EKM|optional',0]],
[[160,110,200,110],[330,110,370,110],[510,110,550,110]]);

const vpcsc=K.dg(700,270,[
[10,10,680,250,'VPC Service Controls perimeter',1],
[40,50,420,170,'Service perimeter',1],
[60,90,150,50,'Project A|BigQuery, Storage',0],[240,90,150,50,'Project B|Cloud SQL',0],
[510,90,160,50,'Outside: internet,|other projects',0],
[510,160,160,40,'Blocked: copy data out',2]],
[[210,115,240,115],[460,115,510,115]]);

/* ---------- 0 ---------- */
L['gcp:13:0']={blocks:[
{p:'No single control makes a system secure. **Defense in depth** layers controls, so a failure of one does not mean a breach. Google Cloud supports each layer and describes the relationship as **shared fate**: Google provides secure defaults and tools, and you configure them well.'},
{svg:depth},
{h:'What Google secures by default'},
{ul:['Physical data centers, custom hardware and boot integrity (Titan chips).','Encryption at rest for all customer data and encryption in transit between Google facilities.','A global private network and DDoS absorption at the edge.','Patched managed services and automatic updates for platforms like Cloud Run.']},
{h:'What you configure'},
{t:[['Area','Key controls','Course lesson'],
['Identity','Least privilege roles, groups, no service account keys, MFA','IAM section'],
['Network','Private IPs, firewall rules, Cloud NAT, Private Google Access','VPC section'],
['Perimeter','VPC Service Controls, Cloud Armor, IAP','This section'],
['Data','CMEK, Secret Manager, DLP, retention and backups','This section'],
['Workloads','Hardened images, patching, Binary Authorization','Compute and GKE sections'],
['Detection','Audit logs, Security Command Center, alerts','This section and operations']]},
{h:'A starting checklist'},
{flow:['Enforce MFA and manage users through an identity provider','Apply organization policies: no external IPs, no key creation, restricted locations','Use dedicated service accounts with minimal roles','Keep workloads private and expose only through load balancers with Cloud Armor','Enable audit logs and Security Command Center','Back up data and test recovery']},
{note:'The Google Cloud Architecture Framework security pillar and the security foundations blueprint give a detailed starting design that you can adapt.'}],
src:[['Security foundations blueprint','https://cloud.google.com/architecture/security-foundations'],['Google Cloud security overview','https://cloud.google.com/security']]};

/* ---------- 1 ---------- */
L['gcp:13:1']={blocks:[
{p:'All data at rest in Google Cloud is encrypted by default with Google-managed keys. **Cloud Key Management Service (Cloud KMS)** lets you create and control your own keys when you need control over rotation, access and revocation.'},
{svg:kms},
{h:'Objects'},
{t:[['Object','Meaning'],
['Key ring','A grouping of keys in a location. Cannot be deleted'],
['Key','A named cryptographic key with a purpose and a protection level'],
['Key version','The actual key material. Rotation creates a new primary version'],
['Purpose','Symmetric encrypt/decrypt, asymmetric sign or decrypt, MAC']]},
{h:'Protection levels'},
{t:[['Level','Where the key lives'],
['Software','Cloud KMS software'],
['HSM','FIPS 140-2 level 3 hardware security modules (Cloud HSM)'],
['External (EKM)','Outside Google Cloud, in a partner key manager you control'],
['Autokey','Automates creation of keys for CMEK-protected resources']]},
{code:`gcloud kms keyrings create prod-keys --location=us-central1
gcloud kms keys create storage-key --keyring=prod-keys --location=us-central1 --purpose=encryption \\
  --rotation-period=90d --next-rotation-time=2026-12-01T00:00:00Z
gcloud kms keys add-iam-policy-binding storage-key --keyring=prod-keys --location=us-central1 \\
  --member="serviceAccount:service-123456789@gs-project-accounts.iam.gserviceaccount.com" --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"
gcloud storage buckets update gs://secure-bucket --default-encryption-key=projects/p/locations/us-central1/keyRings/prod-keys/cryptoKeys/storage-key`},
{h:'CMEK in practice'},
{ul:['Many services accept a **customer-managed encryption key (CMEK)**: Cloud Storage, BigQuery, Compute disks, Cloud SQL, GKE and more.','The service agent of that product needs the Encrypter/Decrypter role on the key.','Disabling or destroying the key makes the data unreadable. Destruction is scheduled with a delay (24 hours by default) so mistakes can be undone.','Keys are regional. The key location should match the resource location.','Rotation does not re-encrypt old data. New data uses the new version, and old versions remain for decryption.']},
{h:'Separation of duties'},
{p:'Keep key administrators (who manage keys) different from key users (who encrypt and decrypt). A key admin should not be able to read the data, and a data admin should not be able to destroy the key.'},
{note:'CMEK adds control but also responsibility and cost. Use it where policy or regulation requires it, not by default for everything.'}],
src:[['Cloud KMS',"https://cloud.google.com/kms/docs"],['CMEK','https://cloud.google.com/kms/docs/cmek']]};

/* ---------- 2 ---------- */
L['gcp:13:2']={blocks:[
{p:'Passwords, API keys and certificates do not belong in source code, images or environment files in repositories. **Secret Manager** stores them securely with versions, access control and audit logs.'},
{h:'Concepts'},
{t:[['Term','Meaning'],
['Secret','A named container with labels and replication policy'],
['Version','An immutable value. Each update adds a version. Versions can be enabled, disabled or destroyed'],
['Replication','Automatic (Google chooses locations) or user-managed (specific regions)'],
['Rotation','A schedule that publishes a Pub/Sub notification so your code can rotate the secret']]},
{code:`gcloud services enable secretmanager.googleapis.com
echo -n "S3cr3t!" | gcloud secrets create db-password --data-file=- --replication-policy=automatic
echo -n "N3wS3cr3t!" | gcloud secrets versions add db-password --data-file=-
gcloud secrets versions access latest --secret=db-password
gcloud secrets add-iam-policy-binding db-password --member="serviceAccount:api-sa@my-project.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets versions disable 1 --secret=db-password`},
{h:'Using secrets in services'},
{t:[['Platform','How'],
['Cloud Run','Reference as an environment variable or mounted file (set-secrets)'],
['Cloud Run functions','Same as Cloud Run'],
['GKE','Secret Manager add-on with the CSI driver, or fetch with client libraries and Workload Identity'],
['Compute Engine','Client library with the VM service account'],
['Cloud Build','Available as secrets in build steps']]},
{h:'Good practice'},
{ul:['Grant **Secret Accessor** only to the service accounts that need each secret, preferably per secret.','Pin to a **version** for stability or use `latest` when you want automatic updates.','Rotate on a schedule and after any exposure. Disable old versions before destroying.','Never log secret values. Audit access with Data Access logs.','Use CMEK where required, and size limit is 64 KiB per version.']},
{note:'Secret Manager is for secrets. Use Cloud KMS to hold keys, and Certificate Manager for TLS certificates.'}],
src:[['Secret Manager','https://cloud.google.com/secret-manager/docs'],['Best practices','https://cloud.google.com/secret-manager/docs/best-practices']]};

/* ---------- 3 ---------- */
L['gcp:13:3']={blocks:[
{p:'IAM controls who can call an API. It does not stop an authorized user, or stolen credentials, from copying data to a project outside your control. **VPC Service Controls (VPC-SC)** adds a **perimeter** around Google Cloud services in your projects, blocking data movement across it.'},
{svg:vpcsc},
{h:'How it works'},
{ul:['You define a **service perimeter** containing projects (or VPC networks) and restricted services (such as BigQuery, Cloud Storage and others).','Calls between resources inside the perimeter are allowed. Calls that cross it, from the internet or from other projects, are blocked unless an **access level** or an **ingress/egress rule** allows them.','It protects against **exfiltration**, stolen credentials and misconfigured IAM that exposes data.','Perimeters are managed at the organization level with **Access Context Manager**.']},
{h:'Parts'},
{t:[['Part','Meaning'],
['Service perimeter','Projects plus restricted services'],
['Access level','Conditions for access from outside: IP ranges, device status, user identity'],
['Ingress rule','Allows specific identities or sources to reach inside services'],
['Egress rule','Allows specific inside identities to call outside resources'],
['Dry-run mode','Logs what would be blocked without blocking']]},
{code:`gcloud access-context-manager policies list --organization=987654321
gcloud access-context-manager perimeters create prod-perimeter --title="Prod" --policy=POLICY_ID \\
  --resources=projects/123456789 --restricted-services=bigquery.googleapis.com,storage.googleapis.com --perimeter-type=regular
gcloud access-context-manager perimeters dry-run create prod-perimeter --policy=POLICY_ID --resources=projects/123456789 --restricted-services=bigquery.googleapis.com`},
{h:'Roll out carefully'},
{flow:['Inventory the projects and services involved and who calls them','Create the perimeter in dry-run mode','Review violation logs (policy denied audit logs) for a few weeks','Add the needed access levels and ingress/egress rules','Enforce the perimeter and keep monitoring']},
{note:'VPC-SC can break pipelines that move data across projects, such as exports and CI/CD tools. Test in dry-run and plan exceptions. It complements IAM and does not replace it.'}],
src:[['VPC Service Controls','https://cloud.google.com/vpc-service-controls/docs/overview'],['Dry run mode','https://cloud.google.com/vpc-service-controls/docs/dry-run-mode']]};

/* ---------- 4 ---------- */
L['gcp:13:4']={blocks:[
{p:'**Security Command Center (SCC)** is Google Cloud\'s security and risk management platform. It finds misconfigurations, vulnerabilities and threats across your organization and presents them as **findings** with severity and guidance.'},
{h:'What it detects'},
{t:[['Capability','Finds'],
['Security Health Analytics','Misconfigurations: public buckets, open firewall rules, missing MFA, weak encryption, excessive service account keys'],
['Event Threat Detection','Threats from logs: suspicious IAM changes, crypto mining, data exfiltration patterns'],
['Container and VM Threat Detection','Malicious binaries, reverse shells and compromised workloads'],
['Vulnerability scanning','Known CVEs in VM images and containers'],
['Web Security Scanner','Common web flaws such as XSS in deployed apps'],
['Posture management','Policies that define desired security state and compare it to reality'],
['Attack path simulation (premium tiers)','Shows how an attacker could reach high-value resources']]},
{h:'Tiers'},
{t:[['Tier','Notes'],
['Standard','Basic misconfiguration detection'],
['Premium','Adds threat detection, compliance reporting and more'],
['Enterprise','Adds multicloud coverage, case management and SOAR features']]},
{p:'Check the pricing page for current capabilities in each tier.'},
{h:'Working with findings'},
{code:`gcloud scc findings list organizations/987654321 --source=- --filter='state="ACTIVE" AND severity="HIGH"' --limit=10
gcloud scc notifications create high-findings --organization=987654321 --pubsub-topic=projects/sec/topics/scc \\
  --filter='severity="HIGH" OR severity="CRITICAL"'`},
{flow:['A finding appears with category, resource and recommended action','Triage by severity and exposure','Fix the cause (for example remove public access) or mute with a reason','Notify teams automatically through Pub/Sub','Review posture and trends regularly']},
{note:'A dashboard full of unaddressed findings is a risk of its own. Assign owners, set priorities and measure time to fix.'}],
src:[['Security Command Center','https://cloud.google.com/security-command-center/docs/concepts-security-command-center-overview']]};

/* ---------- 5 ---------- */
L['gcp:13:5']={blocks:[
{p:'**Sensitive Data Protection** (formerly Cloud Data Loss Prevention, DLP) finds, classifies and protects sensitive data such as names, card numbers, national IDs and secrets across storage, databases and text.'},
{h:'Functions'},
{t:[['Function','What it does'],
['Discovery','Scans BigQuery, Cloud Storage, Cloud SQL and other sources and builds data profiles showing where sensitive data lives'],
['Inspection','Looks for **infoTypes** (over 150 built-in detectors like EMAIL_ADDRESS, CREDIT_CARD_NUMBER) and custom patterns in files, tables and text'],
['De-identification','Transforms sensitive values: mask, redact, replace, hash, tokenize or encrypt (format-preserving)'],
['Risk analysis','Measures re-identification risk of datasets']]},
{code:`# inspect a text snippet with the REST API (conceptual)
POST https://dlp.googleapis.com/v2/projects/my-project/content:inspect
{
  "item": {"value": "Contact ana@example.com, card 4111 1111 1111 1111"},
  "inspectConfig": {"infoTypes": [{"name": "EMAIL_ADDRESS"}, {"name": "CREDIT_CARD_NUMBER"}], "minLikelihood": "LIKELY"}
}`},
{h:'De-identification choices'},
{t:[['Technique','Result','Reversible'],
['Redaction','Value removed','No'],
['Masking','Characters replaced, for example ****1111','No'],
['Replace with infoType','[EMAIL_ADDRESS]','No'],
['Cryptographic hash','Fixed hash, can join datasets','No'],
['Tokenization / format-preserving encryption','Keeps format and consistency for analytics','Yes, with the key'],
['Bucketing','Ages become ranges','No']]},
{h:'Typical uses'},
{ul:['Find unexpected sensitive data in buckets and tables, and tag it with policy tags.','Mask data before it goes to non-production or analytics environments.','Scan chat or support transcripts before storing them.','Prove where regulated data is for audits.']},
{note:'Inspection returns a likelihood for each finding. Tune likelihood thresholds and use custom dictionaries to reduce false positives.'}],
src:[['Sensitive Data Protection','https://cloud.google.com/sensitive-data-protection/docs/sensitive-data-protection-overview'],['InfoType detector reference','https://cloud.google.com/sensitive-data-protection/docs/infotypes-reference']]};

/* ---------- 6 ---------- */
L['gcp:13:6']={blocks:[
{p:'Traditional security trusted anyone inside the network. **BeyondCorp**, Google\'s zero trust model, trusts nobody by location. Every request is evaluated on **who** the user is, **what device** they use and **context**. **Identity-Aware Proxy (IAP)** applies this to your applications.'},
{h:'What IAP does'},
{ul:['Sits in front of web apps behind Google Cloud load balancers, App Engine, Cloud Run and GKE.','Requires users to sign in with their Google or federated identity, then checks IAM before forwarding the request.','Passes a signed header to the app with the user identity.','No VPN needed. Users access internal apps from anywhere securely.']},
{code:`gcloud iap web add-iam-policy-binding --resource-type=backend-services --service=web-bes \\
  --member="group:staff@example.com" --role="roles/iap.httpsResourceAccessor"
gcloud compute ssh vm-1 --tunnel-through-iap     # IAP TCP forwarding for SSH and RDP`},
{h:'Context-Aware Access'},
{p:'**Access levels** in Access Context Manager describe conditions such as corporate IP ranges, device policy (encrypted disk, screen lock), or country. IAP and IAM Conditions can require an access level, so a user on an unmanaged laptop is denied even with valid credentials.'},
{h:'BeyondCorp Enterprise / Chrome Enterprise Premium'},
{ul:['Adds threat and data protection in the Chrome browser, device trust signals and continuous evaluation.','Useful when securing SaaS and internal web apps for a distributed workforce.']},
{h:'Compared'},
{t:[['Need','Tool'],
['Protect an internal web app by identity','IAP'],
['SSH or RDP to private VMs without VPN','IAP TCP forwarding'],
['Require managed devices and location','Context-Aware Access'],
['Stop data leaving projects','VPC Service Controls'],
['Block web attacks at the edge','Cloud Armor']]},
{note:'IAP verifies identity at the load balancer. Make sure backends cannot be reached directly, and verify the IAP signed header in your application.'}],
src:[['Identity-Aware Proxy','https://cloud.google.com/iap/docs/concepts-overview'],['Context-Aware Access','https://cloud.google.com/access-context-manager/docs/overview']]};

/* ---------- 7 ---------- */
L['gcp:13:7']={blocks:[
{p:'Software supply chain attacks insert bad code into builds or images. Google Cloud offers tools to know what you run and to allow only trusted artifacts. Private certificates are another building block for secure service-to-service traffic.'},
{h:'Certificate Authority Service'},
{ul:['**CA Service** is a managed private certificate authority. You create **CA pools** and issue certificates for services, devices and workloads.','Tiers: **DevOps** (high volume, short-lived) and **Enterprise** (long-lived, revocation).','Works with GKE, Cloud Load Balancing mutual TLS, service mesh and custom clients.','Root keys can be protected by Cloud HSM.']},
{code:`gcloud privateca pools create internal-pool --location=us-central1 --tier=devops
gcloud privateca roots create internal-root --pool=internal-pool --location=us-central1 --subject="CN=Internal Root, O=Example"
gcloud privateca certificates create --issuer-pool=internal-pool --issuer-location=us-central1 --generate-key --key-output-file=key.pem --cert-output-file=cert.pem --dns-san="api.internal.example.com" --validity=P30D`},
{h:'Securing images and builds'},
{t:[['Control','Purpose'],
['Artifact Registry with vulnerability scanning (Artifact Analysis)','Find known CVEs in images and packages'],
['Cloud Build provenance','Signed SLSA metadata describing how an image was built'],
['Binary Authorization','Deploy only images with required attestations to GKE, Cloud Run and others'],
['Software Delivery Shield','Collection of supply chain security features across the build and deploy flow'],
['Assured Open Source Software','Google-curated and verified open source packages']]},
{flow:['A developer commits code','Cloud Build builds and tests the image, producing provenance','Artifact Analysis scans for vulnerabilities','An attestor signs the image if it passes policy','Binary Authorization admits only signed images at deploy time']},
{note:'Pin base images by digest, use minimal images, rebuild regularly to pick up patches, and keep scanning running after deployment, because new CVEs appear daily.'}],
src:[['Certificate Authority Service','https://cloud.google.com/certificate-authority-service/docs/ca-service-overview'],['Binary Authorization','https://cloud.google.com/binary-authorization/docs/overview'],['Artifact Analysis','https://cloud.google.com/artifact-analysis/docs/artifact-analysis']]};

/* ---------- 8 ---------- */
L['gcp:13:8']={blocks:[
{p:'Regulated industries and governments need proof that cloud workloads meet standards and keep data where the law requires. Google Cloud offers certifications, regional controls and special environments.'},
{h:'Certifications and reports'},
{ul:['Google Cloud holds many certifications and attestations such as ISO 27001, SOC 1/2/3, PCI DSS and others by region and product.','The **Compliance resource center** lists certifications, reports and mappings.','Certification covers Google\'s part of the shared responsibility. You still must configure your workloads to be compliant.']},
{h:'Data residency and sovereignty'},
{t:[['Control','Purpose'],
['Resource locations organization policy','Only create resources in allowed regions'],
['Regional and dual-region storage','Keep data in a country or area'],
['Assured Workloads','Folders with control packages that enforce compliance settings (for example FedRAMP, CJIS, EU data boundaries, sovereign controls)'],
['Access Transparency','Logs of actions taken by Google staff on your content'],
['Access Approval','You approve or deny Google staff access requests'],
['Key Access Justifications and EKM','Control keys outside Google and see why a key is requested'],
['Confidential Computing','Encrypts data in use in memory']]},
{code:`gcloud assured workloads list --organization=987654321 --location=us
gcloud org-policies describe gcp.resourceLocations --organization=987654321 --effective`},
{h:'Building evidence'},
{ul:['Keep audit logs in locked storage with retention.','Use Security Command Center compliance reports to map findings to standards.','Document controls, owners and exceptions.','Test backup, restore and incident response regularly.']},
{h:'Shared responsibility reminder'},
{t:[['Google','You'],
['Compliant infrastructure and certified services','Choose the right services and regions'],
['Platform security and patching of managed services','Configure IAM, network and data controls'],
['Transparency tools and reports','Collect evidence and run your own processes']]},
{note:'Using a certified product does not make your application compliant by itself. The configuration and your processes are in scope.'}],
src:[['Compliance resource center','https://cloud.google.com/security/compliance'],['Assured Workloads','https://cloud.google.com/assured-workloads/docs/overview']]};
})();
