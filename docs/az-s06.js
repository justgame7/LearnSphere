/* LearnSphere - Azure Administrator, Section 06: Automation with ARM Templates & Bicep.
   Lectures 0-6 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const decl=K.dg(700,200,[
[10,10,680,180,'Declarative deployment',1],
[30,60,150,70,'Template|desired state',2],[260,60,170,70,'Azure Resource|Manager compares|with current state',0],[510,60,160,70,'Resources|created or updated',0]],
[[180,95,260,95],[430,95,510,95]]);

const bicep=K.dg(700,200,[
[10,10,680,180,'Bicep compiles to ARM JSON',1],
[30,60,150,70,'main.bicep|and modules',2],[260,60,170,70,'Bicep compiler|az bicep build',0],[510,60,160,70,'ARM template|JSON deployed',0]],
[[180,95,260,95],[430,95,510,95]]);

const mode=K.dg(700,220,[
[10,10,680,200,'Deployment modes',1],
[30,50,300,140,'Incremental (default)|Adds or updates resources in the template|Leaves other resources alone',2],
[370,50,300,140,'Complete|Deploys the template|Deletes resources in the group that are not in it',0]],
[]);

/* ---------- 0 ---------- */
L['az:5:0']={blocks:[
{p:'**Infrastructure as code (IaC)** means describing your infrastructure in files and deploying those files, instead of clicking in the portal. In Azure the native approach is **declarative**: you state what should exist, and Azure Resource Manager makes it so.'},
{svg:decl},
{h:'Why administrators use it'},
{ul:['**Repeatable**: the same template builds the same environment each time.','**Reviewable**: changes are text files in version control with history.','**Idempotent**: deploying again with the same file leaves the result unchanged, or only fixes drift.','**Fast**: whole environments in minutes.','**Documented**: the template is the description of what exists.']},
{h:'Options in Azure'},
{t:[['Tool','Notes'],
['**ARM templates**','JSON, the native format and the target all others compile to'],
['**Bicep**','A clearer language that compiles to ARM JSON, with first-class support'],
['**Terraform**','Third-party, multi-cloud, state file based'],
['**Azure CLI or PowerShell scripts**','Imperative, run step by step, not idempotent by default']]},
{note:'The AZ-104 exam focuses on reading, modifying and deploying ARM templates and Bicep, not authoring large templates from scratch.'}],
src:[['Infrastructure as code',K.D+'azure-resource-manager/templates/overview']]};

/* ---------- 1 ---------- */
L['az:5:1']={blocks:[
{p:'An **ARM template** is a JSON file with a fixed set of top-level sections.'},
{code:`{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "storageName": { "type": "string", "minLength": 3, "maxLength": 24 },
    "location": { "type": "string", "defaultValue": "[resourceGroup().location]" }
  },
  "variables": {
    "sku": "Standard_LRS"
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2023-05-01",
      "name": "[parameters('storageName')]",
      "location": "[parameters('location')]",
      "sku": { "name": "[variables('sku')]" },
      "kind": "StorageV2"
    }
  ],
  "outputs": {
    "endpoint": { "type": "string", "value": "[reference(parameters('storageName')).primaryEndpoints.blob]" }
  }
}`},
{t:[['Section','Purpose'],
['`$schema`, `contentVersion`','Identify the template language and your own version'],
['`parameters`','Values supplied at deployment time, with types and defaults'],
['`variables`','Values computed once and reused inside the template'],
['`resources`','What to deploy: type, API version, name, location, properties'],
['`outputs`','Values returned after deployment']]},
{h:'Expressions'},
{p:'Strings in square brackets are **expressions** evaluated at deployment, such as `[parameters(\'x\')]`, `[resourceGroup().location]` or `[concat(...)]`. A resource can depend on another with `dependsOn`, or implicitly by referencing it.'}],
src:[['Template structure and syntax',K.ARM+'templates/syntax']]};

/* ---------- 2 ---------- */
L['az:5:2']={blocks:[
{p:'**Bicep** expresses the same deployment with less noise. It is a domain-specific language that is transpiled into ARM JSON before deployment.'},
{svg:bicep},
{code:`@minLength(3)
@maxLength(24)
param storageName string
param location string = resourceGroup().location

var sku = 'Standard_LRS'

resource stg 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  sku: { name: sku }
  kind: 'StorageV2'
}

output endpoint string = stg.properties.primaryEndpoints.blob`},
{h:'Concepts'},
{t:[['Bicep','Meaning'],
['`param`','Input value, with decorators for validation'],
['`var`','Computed value'],
['`resource`','A resource, with symbolic name, type and API version'],
['`output`','Value returned'],
['`module`','Another Bicep file deployed as a unit'],
['`existing`','Refers to a resource that already exists']]},
{h:'Modules and parameter files'},
{code:`module network './network.bicep' = {
  name: 'networkDeploy'
  params: {
    vnetName: 'vnet-app'
    addressSpace: '10.10.0.0/16'
  }
}

// prod.bicepparam
using './main.bicep'
param storageName = 'stappprod001'`},
{note:'Dependencies are inferred from references, so you rarely write `dependsOn`. Use `az bicep install` and the VS Code Bicep extension for IntelliSense.'}],
src:[['Bicep overview',K.BICEP+'overview'],['Bicep file structure',K.BICEP+'file']]};

/* ---------- 3 ---------- */
L['az:5:3']={blocks:[
{p:'Most real tasks are **changing an existing template**, not writing one. A safe change follows a routine.'},
{flow:['Read the template and find every place the thing is used','Make the smallest change in a branch or copy','Validate syntax and run what-if against the target','Deploy to a test resource group first','Review the diff and the result, then promote']},
{h:'Common edits'},
{t:[['Change','How'],
['Add a parameter','Add `param` with a default and use it in the resource'],
['Change a SKU or size','Edit the property. Some changes need replacement, check what-if'],
['Add a tag to everything','Add a `tags` parameter and set `tags: tags` on each resource'],
['Add a resource','Add a `resource` block, reference others to create a dependency'],
['Rename a resource','Changes the name, which usually creates a new one and leaves the old']]},
{h:'Preview before you deploy'},
{code:`az deployment group what-if --resource-group rg-test --template-file main.bicep --parameters prod.bicepparam
az deployment group validate --resource-group rg-test --template-file main.bicep`},
{p:'What-if lists each resource as **create, modify, delete, ignore or no change**, with property-level differences.'},
{note:'Do not edit a template and deploy straight to production. A changed resource name or an immutable property can cause a delete and recreate.'}],
src:[['Deployment what-if',K.ARM+'templates/deploy-what-if']]};

/* ---------- 4 ---------- */
L['az:5:4']={blocks:[
{p:'A **deployment** sends a template and parameters to ARM at a **scope**. You can deploy from the portal, CLI, PowerShell, SDKs or pipelines.'},
{h:'Scopes'},
{t:[['Scope','Command group','Use'],
['Resource group','`az deployment group create`','Most workload resources'],
['Subscription','`az deployment sub create`','Resource groups, policy, role assignments'],
['Management group','`az deployment mg create`','Policy and governance across subscriptions'],
['Tenant','`az deployment tenant create`','Management groups and tenant-level resources']]},
{code:`# Azure CLI
az deployment group create --resource-group rg-app --template-file main.bicep --parameters storageName=stapp001

# Azure PowerShell
New-AzResourceGroupDeployment -ResourceGroupName rg-app -TemplateFile main.bicep -storageName stapp001`},
{h:'Incremental versus complete'},
{svg:mode},
{ul:['**Incremental** is the default and safest.','**Complete** can delete resources in the group that are not in the template. Use only when you know the template is the entire truth, and always preview with what-if.']},
{h:'Where to see results'},
{ul:['Resource group, **Deployments**: status, inputs, outputs, and operation errors.','Deployment history is kept up to 800 per group, with older ones deleted automatically.']}],
src:[['Deployment modes',K.ARM+'templates/deployment-modes'],['Deploy Bicep with CLI',K.BICEP+'deploy-cli']]};

/* ---------- 5 ---------- */
L['az:5:5']={blocks:[
{p:'Existing resources can be turned into a template, which helps you document, copy or rebuild what already exists. You can also convert between ARM JSON and Bicep.'},
{h:'Export a template'},
{ul:['Resource group or resource, **Export template**: a template of the current state.','Deployment history, **Template**: the exact template used for that deployment.','CLI: `az group export`.']},
{code:`az group export --name rg-app > exported.json
az bicep decompile --file exported.json         # produces exported.bicep
az bicep build --file main.bicep                # produces main.json`},
{h:'What an export does and does not give you'},
{t:[['Aspect','Reality'],
['Completeness','Not every resource type can be exported cleanly'],
['Parameters','Exports often hard-code values, so you must add parameters'],
['Secrets','Passwords and keys are not exported'],
['Quality','Exported templates are verbose and need cleanup'],
['Decompile','Conversion to Bicep is best effort and needs review']]},
{note:'Treat an export as a starting point. Clean it, parameterize it and test it before relying on it.'}],
src:[['Export template',K.ARM+'templates/export-template-portal'],['Decompile ARM to Bicep',K.BICEP+'decompile']]};

/* ---------- 6 ---------- */
L['az:5:6']={blocks:[
{p:'Take a small template, change it, deploy it, then export the result and convert it to Bicep.'},
{flow:['Start from a template that deploys a storage account','Add a tags parameter and an output','Preview with what-if and deploy','Change the SKU and deploy again to see an update','Export the resource group as a template','Decompile to Bicep and compare']},
{code:`// main.bicep
param storageName string
param location string = resourceGroup().location
param tags object = {}

resource stg 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
}

output blobEndpoint string = stg.properties.primaryEndpoints.blob`},
{code:`az group create --name rg-iac --location westeurope
az deployment group what-if -g rg-iac --template-file main.bicep --parameters storageName=stiac001 tags='{"owner":"sam"}'
az deployment group create -g rg-iac --template-file main.bicep --parameters storageName=stiac001 tags='{"owner":"sam"}'
az group export -n rg-iac > export.json
az bicep decompile --file export.json`},
{h:'Questions to answer'},
{t:[['Question','Where to look'],
['What did what-if show for the first deployment?','Create of the storage account'],
['What happens on a second identical deploy?','No changes, deployment is idempotent'],
['What is different in the exported file?','More properties and no parameters']]}],
src:[['Quickstart: Bicep',K.BICEP+'quickstart-create-bicep-use-visual-studio-code']]};

})();
