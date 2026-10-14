/* LearnSphere - Azure Administrator, Section 15: Security Administration.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const layers=K.dg(700,260,[
[10,10,680,240,'Defense in depth',1],
[30,45,640,34,'Identity and access: Entra ID, MFA, Conditional Access, PIM',0],
[30,90,640,34,'Network: NSGs, private endpoints, firewall, Bastion',0],
[30,135,640,34,'Compute and data: patching, encryption, Key Vault, backup',0],
[30,180,640,34,'Monitoring and response: Defender for Cloud, alerts, logs',2]],
[]);

const ca=K.dg(700,200,[
[10,10,680,180,'Conditional Access evaluates signals then decides',1],
[30,60,170,70,'Signals|user, group, app,|location, device, risk',0],[250,60,170,70,'Policy|if conditions match',2],[470,60,200,70,'Decision|block, require MFA,|compliant device',0]],
[[200,95,250,95],[420,95,470,95]]);

const pim=K.dg(700,200,[
[10,10,680,180,'Privileged Identity Management',1],
[30,60,140,70,'Eligible|assignment',0],[220,60,140,70,'Activate|MFA, reason,|approval',2],[410,60,120,70,'Active for|limited time',0],[570,60,100,70,'Expires|automatically',0]],
[[170,95,220,95],[360,95,410,95],[530,95,570,95]]);

/* ---------- 0 ---------- */
L['az:14:0']={blocks:[
{p:'Security in Azure is **layered**. No single control is enough, so an administrator combines identity, network, data and monitoring controls.'},
{svg:layers},
{h:'Zero Trust principles'},
{t:[['Principle','In practice'],
['**Verify explicitly**','Authenticate and authorize on every request using all signals'],
['**Use least privilege**','Just enough and just-in-time access, narrow scopes'],
['**Assume breach**','Segment networks, encrypt, log and monitor to limit blast radius']]},
{h:'Where an administrator acts'},
{ul:['**Identity**: MFA, Conditional Access, PIM, reviewing guests and roles.','**Network**: NSGs, private endpoints, Bastion, no exposed management ports.','**Data**: encryption, Key Vault, backup and immutability.','**Posture**: Defender for Cloud secure score and recommendations.','**Detection**: logs, alerts and incident response.']},
{note:'Identity is the new perimeter. Most real compromises start with stolen credentials, so identity controls come first.'}],
src:[['Azure security documentation',K.D+'security/'],['Zero Trust','https://learn.microsoft.com/en-us/security/zero-trust/']]};

/* ---------- 1 ---------- */
L['az:14:1']={blocks:[
{p:'**Conditional Access** policies are if-then rules evaluated at sign-in: if the user, app, location, device or risk matches, then grant or block access with requirements.'},
{svg:ca},
{h:'Common policies'},
{t:[['Policy','Effect'],
['Require MFA for administrators','Admin roles must complete MFA'],
['Require MFA for all users','Everyone uses MFA'],
['Block legacy authentication','Stops protocols that cannot do MFA'],
['Require compliant device','Only managed devices can reach apps'],
['Block by location','Deny sign-in from unexpected countries'],
['Require MFA for risky sign-ins','Uses Identity Protection signals (P2)']]},
{h:'Safe rollout'},
{flow:['Create the policy in report-only mode','Review the impact in sign-in logs and the What if tool','Exclude emergency break-glass accounts','Enable for a pilot group','Enable for everyone']},
{h:'Licensing and alternatives'},
{ul:['Conditional Access requires Entra ID **P1**.','Without it, **security defaults** provide a baseline of MFA and legacy auth blocking, for free.','Security defaults and Conditional Access cannot be used together.']},
{note:'Always keep two cloud-only break-glass accounts excluded from policies, with strong credentials, so a bad policy cannot lock everyone out.'}],
src:[['Conditional Access',K.ENTRA+'identity/conditional-access/overview'],['Security defaults',K.ENTRA+'fundamentals/security-defaults']]};

/* ---------- 2 ---------- */
L['az:14:2']={blocks:[
{p:'Passwords alone are weak. The **authentication methods** you allow and require decide how strong sign-in really is.'},
{t:[['Method','Strength','Notes'],
['**Passkeys (FIDO2)** and **Windows Hello**','Phishing-resistant','Preferred for administrators'],
['**Microsoft Authenticator**','Strong','Push with number matching, or passwordless sign-in'],
['**OATH hardware or software tokens**','Strong','Codes from a token or app'],
['**SMS and voice**','Weaker','Susceptible to SIM swap, use only where needed'],
['**Temporary Access Pass**','Time-limited','For bootstrapping and recovery']]},
{h:'Temporary Access Pass'},
{p:'A **Temporary Access Pass (TAP)** is a time-limited passcode that an administrator issues so a user can sign in and register passwordless methods, or recover when they lost every method.'},
{h:'Authentication strengths'},
{p:'Conditional Access can require an **authentication strength**, for example phishing-resistant MFA for admin roles, and not only any MFA.'},
{code:`# Graph PowerShell: create a Temporary Access Pass
Connect-MgGraph -Scopes UserAuthenticationMethod.ReadWrite.All
New-MgUserAuthenticationTemporaryAccessPassMethod -UserId sam@contoso.com -LifetimeInMinutes 60`},
{note:'Use the Authentication methods policy to enable or disable each method, and target groups so rollout is gradual.'}],
src:[['Authentication methods',K.ENTRA+'identity/authentication/concept-authentication-methods'],['Temporary Access Pass',K.ENTRA+'identity/authentication/howto-authentication-temporary-access-pass']]};

/* ---------- 3 ---------- */
L['az:14:3']={blocks:[
{p:'**Privileged Identity Management (PIM)** removes standing administrator access. People become **eligible** for a role and **activate** it only when needed, for a limited time.'},
{svg:pim},
{t:[['Term','Meaning'],
['**Eligible**','Can activate the role, but has no access until then'],
['**Active**','Has the role now. Can be time-bound'],
['**Activation**','Request with MFA, justification, optionally approval and ticket'],
['**Access review**','Periodic confirmation that assignments are still needed']]},
{h:'What PIM covers'},
{ul:['**Microsoft Entra roles**, such as Global Administrator.','**Azure resource roles**, such as Owner on a subscription.','**Groups**, through PIM for groups.','Audit history and alerts about role use.']},
{h:'Requirements'},
{ul:['Needs **Entra ID P2** or Governance licensing for users who benefit.','Set role settings: maximum activation time, MFA, approvers.','Make most privileged roles **eligible** and keep few permanent ones, such as break-glass accounts.']},
{note:'A role assigned permanently in RBAC is invisible to PIM activation controls. Convert standing assignments to eligible ones in PIM.'}],
src:[['Privileged Identity Management',K.ENTRA+'id-governance/privileged-identity-management/pim-configure']]};

/* ---------- 4 ---------- */
L['az:14:4']={blocks:[
{p:'**Microsoft Defender for Cloud** assesses the security posture of your Azure, hybrid and multicloud resources and gives **recommendations** to improve it.'},
{h:'Key pieces'},
{t:[['Piece','What it does'],
['**Secure score**','A percentage showing how many recommended controls you have met'],
['**Recommendations**','Prioritized actions with remediation steps'],
['**Regulatory compliance**','Maps your resources against standards'],
['**Defender CSPM**','Advanced posture features such as attack paths (paid)'],
['**Foundational CSPM**','Free baseline assessment on by default']]},
{flow:['Open Defender for Cloud, Recommendations','Sort by impact on secure score','Open a recommendation and review affected resources','Apply the fix, or use Quick fix or a policy','Exempt with a reason when a finding is accepted','Watch the secure score update']},
{code:`az security assessment list -o table
az security secure-scores list -o table`},
{note:'The secure score is a guide, not a goal in itself. Fix high-impact recommendations on production first.'}],
src:[['Defender for Cloud',K.D+'defender-for-cloud/defender-for-cloud-introduction'],['Secure score',K.D+'defender-for-cloud/secure-score-security-controls']]};

/* ---------- 5 ---------- */
L['az:14:5']={blocks:[
{p:'Beyond posture, **Defender plans** detect threats on specific resource types and raise **security alerts**.'},
{t:[['Plan','Protects','Example detection'],
['**Servers**','VMs and Arc servers','Suspicious process, brute force on RDP, just-in-time access'],
['**Storage**','Storage accounts','Unusual access, malware upload'],
['**Databases**','Azure SQL and others','SQL injection, anomalous queries'],
['**Key Vault**','Vaults','Unusual access patterns'],
['**Containers**','Registries and clusters','Vulnerable images, runtime threats'],
['**App Service**','Web apps','Attacks against the app'],
['**Resource Manager**','Management operations','Suspicious control plane activity']]},
{h:'Working with alerts'},
{ul:['Alerts have a **severity** and map to the kill chain stage.','Send alerts to email, a SIEM or **Microsoft Sentinel**.','Use **workflow automation** to start a Logic App on an alert.','Plans are billed per resource, so enable them on what matters.']},
{h:'Just-in-time VM access'},
{p:'JIT access, part of Defender for Servers, keeps management ports closed and opens them for a requester for a limited time with NSG rules.'},
{note:'Enable plans per subscription and review cost. A broad enablement on dev subscriptions can add noise and expense.'}],
src:[['Defender plans',K.D+'defender-for-cloud/defender-for-cloud-introduction'],['Just-in-time VM access',K.D+'defender-for-cloud/just-in-time-access-overview']]};

/* ---------- 6 ---------- */
L['az:14:6']={blocks:[
{p:'**Azure Key Vault** securely stores **secrets**, **keys** and **certificates**, and logs access to them. Applications retrieve secrets at runtime, so none are stored in code or config.'},
{t:[['Object','Examples'],
['**Secrets**','Passwords, connection strings, tokens'],
['**Keys**','Encryption keys, software or HSM-backed'],
['**Certificates**','TLS certificates with lifecycle and renewal']]},
{h:'Access model'},
{t:[['Model','Notes'],
['**Azure RBAC** (recommended)','Roles such as Key Vault Secrets User and Key Vault Administrator. Consistent with the rest of Azure'],
['**Vault access policy** (legacy)','Per-vault permission lists']]},
{h:'Protecting the vault'},
{ul:['**Soft delete** keeps deleted objects recoverable and is always on.','**Purge protection** prevents permanent deletion during retention.','**Firewall and private endpoint** limit network access.','**Diagnostic logs** record every access.','Use **managed identities** so apps need no credentials.']},
{code:`az keyvault create -g rg-sec -n kv-prod-001 --enable-rbac-authorization true --enable-purge-protection true
az role assignment create --assignee <mi-id> --role "Key Vault Secrets User" --scope $(az keyvault show -n kv-prod-001 --query id -o tsv)
az keyvault secret set --vault-name kv-prod-001 --name dbpassword --value "<value>"
az keyvault secret show --vault-name kv-prod-001 --name dbpassword --query value -o tsv`},
{note:'Key Vault has Standard and Premium SKUs, and Managed HSM for dedicated HSM requirements. Premium adds HSM-protected keys.'}],
src:[['Key Vault overview',K.KV+'general/overview'],['Azure RBAC for Key Vault',K.KV+'general/rbac-guide']]};

/* ---------- 7 ---------- */
L['az:14:7']={blocks:[
{p:'Data should be protected **at rest** and **in transit**. Azure does most of this by default, and you must verify and tighten the rest.'},
{h:'At rest'},
{t:[['Service','Default','Stronger option'],
['**Storage**','256-bit AES SSE, Microsoft-managed keys','Customer-managed keys in Key Vault'],
['**Managed disks**','SSE with platform keys','Encryption at host, disk encryption sets'],
['**Azure SQL**','Transparent data encryption on','Customer-managed TDE protector'],
['**Backups**','Encrypted in the vault','Customer-managed keys for the vault']]},
{h:'In transit'},
{ul:['Require **HTTPS only** and a minimum **TLS 1.2** on storage and web apps.','Use **SMB encryption** for Azure Files.','Use private connectivity such as VPN, ExpressRoute with MACsec options, and private endpoints.','Within Azure, platform traffic between datacenters is encrypted by Microsoft.']},
{code:`az storage account update -n stdemoapp001 -g rg-storage --https-only true --min-tls-version TLS1_2
az webapp update -g rg-web -n webapp-demo-001 --https-only true
az webapp config set -g rg-web -n webapp-demo-001 --min-tls-version 1.2`},
{note:'Use Azure Policy to audit or deny resources without encryption in transit, so the setting stays enforced as new resources are created.'}],
src:[['Azure encryption overview',K.D+'security/fundamentals/encryption-overview']]};

/* ---------- 8 ---------- */
L['az:14:8']={blocks:[
{p:'Harden a lab subscription using the controls from this section, then review the result in Defender for Cloud.'},
{flow:['Enable security defaults or a report-only Conditional Access policy requiring MFA for admins','Make an Owner assignment eligible in PIM, if licensed','Create a Key Vault with RBAC and purge protection','Move a secret out of an app setting into Key Vault with a managed identity','Require HTTPS and TLS 1.2 on storage and web app','Review Defender for Cloud recommendations and fix two']},
{h:'Checklist'},
{t:[['Area','Target'],
['MFA','Required for all admins'],
['Standing owners','Few, with break-glass accounts monitored'],
['Secrets','In Key Vault, accessed by managed identity'],
['Network','No public RDP or SSH, private endpoints where possible'],
['Transit','HTTPS only, TLS 1.2 or later'],
['Posture','Secure score recommendations triaged']]},
{note:'Document each exception, such as a public endpoint, with an owner and expiry. Hardening is a routine, so schedule a monthly review.'}],
src:[['Azure security best practices',K.D+'security/fundamentals/best-practices-and-patterns']]};

})();
