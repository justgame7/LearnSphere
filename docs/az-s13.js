/* LearnSphere - Azure Administrator, Section 13: Monitoring & Alerting.
   Lectures 0-8 are core; additional lectures (not written yet) follow. Needs az-common.js. */
(function(){
const K=window.AZ,L=window.LESSONS;

const mon=K.dg(700,260,[
[10,10,680,240,'Azure Monitor',1],
[25,50,150,50,'Applications|and code',0],[25,110,150,50,'VMs and guest OS',0],[25,170,150,50,'Azure resources|and subscription',0],
[250,70,190,110,'Data platform|Metrics store|Log Analytics',2],
[520,50,150,40,'Insights',0],[520,100,150,40,'Alerts and actions',0],[520,150,150,40,'Dashboards and KQL',0]],
[[175,75,250,110],[175,135,250,125],[175,195,250,140],[440,110,520,70],[440,125,520,120],[440,140,520,170]]);

const diag=K.dg(700,220,[
[10,10,680,200,'Diagnostic settings route resource logs',1],
[30,70,140,70,'Azure resource|logs and metrics',0],[240,70,140,70,'Diagnostic|setting',2],[450,40,200,40,'Log Analytics workspace',0],[450,95,200,40,'Storage account',0],[450,150,200,40,'Event Hub or partner',0]],
[[170,105,240,105],[380,105,450,60],[380,105,450,115],[380,105,450,170]]);

const alert=K.dg(700,200,[
[10,10,680,180,'Alert flow',1],
[30,60,120,70,'Signal|metric, log,|activity',0],[190,60,130,70,'Alert rule|condition',2],[360,60,130,70,'Alert processing|rule optional',0],[530,60,140,70,'Action group|email, SMS, webhook',0]],
[[150,95,190,95],[320,95,360,95],[490,95,530,95]]);

/* ---------- 0 ---------- */
L['az:12:0']={blocks:[
{p:'**Azure Monitor** collects, analyzes and acts on telemetry from Azure, on-premises and other clouds. It is where you answer "is it healthy?" and "what changed?".'},
{svg:mon},
{h:'The two data stores'},
{t:[['Store','Holds','Strength'],
['**Metrics**','Numeric values over time, collected automatically for most Azure resources','Fast, near real time, low cost, 93-day retention'],
['**Logs**','Records with many fields, stored in Log Analytics workspaces','Rich queries with KQL and correlation across sources']]},
{h:'What you do with data'},
{ul:['**Insights**: curated views for VMs, storage, networks and containers.','**Metrics Explorer and workbooks**: charts and reports.','**Log queries**: ad hoc investigation with KQL.','**Alerts**: notify or act when conditions occur.','**Autoscale**: scale in response to metrics.']},
{h:'Data sources'},
{t:[['Source','What you get'],
['Platform metrics','Collected automatically, free'],
['Activity log','Subscription-level control plane events'],
['Resource logs','Detailed service logs, need a diagnostic setting'],
['Guest OS data','Performance counters and events through the Azure Monitor agent'],
['Application data','Application Insights telemetry']]},
{note:'Platform metrics and the activity log are on by default. Resource logs and guest data are not, which is a frequent exam point.'}],
src:[['Azure Monitor overview',K.MON+'overview']]};

/* ---------- 1 ---------- */
L['az:12:1']={blocks:[
{p:'**Metrics Explorer** is where you chart platform metrics for any resource, compare them and pin them to dashboards.'},
{h:'Key concepts'},
{t:[['Concept','Meaning'],
['**Metric**','A named measurement such as Percentage CPU'],
['**Aggregation**','Average, minimum, maximum, sum or count over the time grain'],
['**Time granularity**','The bucket size, from one minute upward'],
['**Dimension**','A property to split or filter by, such as instance or API name'],
['**Namespace**','Group of metrics for a resource']]},
{h:'Using it'},
{flow:['Open Monitor, Metrics, or Metrics on a resource','Select the scope and metric','Choose aggregation and time range','Add a filter or split by a dimension','Pin to a dashboard or create an alert from the chart']},
{code:`az monitor metrics list --resource <vm-id> --metric "Percentage CPU" --interval PT5M --aggregation Average --start-time 2026-10-01T00:00:00Z
az monitor metrics list-definitions --resource <vm-id> -o table`},
{note:'Platform metrics for a VM show the host view. Memory and disk space inside the guest need guest metrics from the Azure Monitor agent.'}],
src:[['Metrics Explorer',K.MON+'essentials/analyze-metrics']]};

/* ---------- 2 ---------- */
L['az:12:2']={blocks:[
{p:'The **activity log** records subscription-level control plane events: who created, changed or deleted a resource and when. **Diagnostic settings** send resource logs and metrics to destinations you choose.'},
{h:'Activity log'},
{ul:['Retained for **90 days** in the portal.','Categories include Administrative, Service Health, Resource Health, Alert, Autoscale, Policy and Security.','To keep it longer or query it, send it to a Log Analytics workspace with a diagnostic setting at the subscription.']},
{svg:diag},
{h:'Diagnostic settings'},
{t:[['Destination','Use'],
['**Log Analytics workspace**','Query, alert and correlate'],
['**Storage account**','Cheap long-term archive'],
['**Event Hub**','Stream to SIEM or external tools'],
['**Partner solution**','Third-party integration']]},
{code:`az monitor diagnostic-settings create --name to-law --resource <storage-account-id>/blobServices/default --workspace <workspace-id> --logs '[{"category":"StorageRead","enabled":true},{"category":"StorageWrite","enabled":true}]' --metrics '[{"category":"Transaction","enabled":true}]'
az monitor activity-log list --resource-group rg-app --max-events 20 --offset 7d`},
{note:'Each resource needs its own diagnostic setting. Use Azure Policy with DeployIfNotExists to apply them at scale.'}],
src:[['Activity log',K.MON+'essentials/activity-log'],['Diagnostic settings',K.MON+'essentials/diagnostic-settings']]};

/* ---------- 3 ---------- */
L['az:12:3']={blocks:[
{p:'A **Log Analytics workspace** is the store and query engine for log data. The **Azure Monitor agent (AMA)** collects data from machines, and **data collection rules (DCRs)** say what to collect and where to send it.'},
{flow:['Create a Log Analytics workspace','Install the Azure Monitor agent on the VM or enable it automatically','Create a data collection rule with data sources and a destination','Associate the rule with the VM','Data arrives in tables such as Perf, Syslog and Event']},
{h:'Workspace design'},
{ul:['Pricing is mainly by **data ingested** and retention beyond the included period.','Default retention is **30 days** for most tables, and configurable up to years.','One central workspace is simpler, and several can be used for isolation or regional needs.','Access is controlled by RBAC at the workspace or table level.']},
{t:[['Piece','Replaces / role'],
['Azure Monitor agent','Replaces the retired Log Analytics (MMA) agent'],
['Data collection rule','Defines sources such as performance counters, Windows events, Syslog'],
['DCR association','Links a rule to a machine']]},
{code:`az monitor log-analytics workspace create -g rg-mon -n law-prod --retention-time 90
az monitor data-collection rule create -g rg-mon -n dcr-vm --location westeurope --rule-file dcr.json
az monitor data-collection rule association create --name assoc1 --rule-id <dcr-id> --resource <vm-id>`},
{note:'The older Log Analytics agent was retired in 2024. Existing references to it in scripts and documents need to move to AMA and DCRs.'}],
src:[['Log Analytics workspaces',K.MON+'logs/log-analytics-workspace-overview'],['Azure Monitor agent',K.MON+'agents/azure-monitor-agent-overview']]};

/* ---------- 4 ---------- */
L['az:12:4']={blocks:[
{p:'**Kusto Query Language (KQL)** is used to query logs. A query starts with a table and pipes results through operators.'},
{code:`// Average CPU per computer, last hour
Perf
| where TimeGenerated > ago(1h)
| where ObjectName == "Processor" and CounterName == "% Processor Time"
| summarize AvgCPU = avg(CounterValue) by Computer
| order by AvgCPU desc
| take 10`},
{t:[['Operator','Does'],
['`where`','Filter rows'],
['`project`','Choose and rename columns'],
['`extend`','Add computed columns'],
['`summarize`','Aggregate, with `by` to group'],
['`order by`, `top`, `take`','Sort and limit'],
['`count`','Count rows'],
['`render`','Visualize as a chart'],
['`join`','Combine tables']]},
{code:`// Failed sign-ins grouped by hour
SigninLogs
| where ResultType != 0
| summarize Failures = count() by bin(TimeGenerated, 1h)
| render timechart

// Who deleted resources recently
AzureActivity
| where OperationNameValue endswith "DELETE" and ActivityStatusValue == "Success"
| project TimeGenerated, Caller, ResourceGroup, Resource`},
{h:'Habits'},
{ul:['Always filter by time first, to read less data.','Use `take 10` while exploring.','Save useful queries, and use them as the basis for alerts.']}],
src:[['KQL overview',K.MON+'logs/log-query-overview'],['Kusto Query Language reference','https://learn.microsoft.com/en-us/kusto/query/']]};

/* ---------- 5 ---------- */
L['az:12:5']={blocks:[
{p:'An **alert rule** watches a signal and fires when a condition is met. An **action group** says who to notify or what to run.'},
{svg:alert},
{h:'Alert types'},
{t:[['Type','Signal','Example'],
['**Metric**','Platform metric, near real time','CPU above 80 percent for 5 minutes'],
['**Log search**','KQL query result','More than 10 failed sign-ins in 15 minutes'],
['**Activity log**','Control plane event','A resource group was deleted'],
['**Service health**','Azure incidents affecting you','An outage in your region']]},
{h:'Action groups'},
{ul:['Email, SMS, push and voice notifications.','Webhook, Azure Function, Logic App, Automation runbook, ITSM.','One action group can be reused by many rules.']},
{h:'Alert processing rules'},
{p:'**Alert processing rules** modify alerts after they fire without editing each rule: suppress notifications during maintenance, add an action group to all alerts for a scope, or limit by schedule.'},
{code:`az monitor action-group create -g rg-mon -n ag-ops --short-name ops --action email oncall oncall@contoso.com
az monitor metrics alert create -g rg-mon -n cpu-high --scopes <vm-id> --condition "avg Percentage CPU > 80" --window-size 5m --evaluation-frequency 1m --action ag-ops --severity 2`},
{note:'Severity runs 0 (critical) to 4 (verbose). Choose severities that decide whether someone is woken up.'}],
src:[['Azure Monitor alerts',K.MON+'alerts/alerts-overview'],['Action groups',K.MON+'alerts/action-groups']]};

/* ---------- 6 ---------- */
L['az:12:6']={blocks:[
{p:'**Insights** are curated monitoring experiences built on Azure Monitor data. They give dashboards, charts and recommendations for a resource type without building them yourself.'},
{t:[['Insight','Shows','Needs'],
['**VM insights**','CPU, memory, disk, network and process map of dependencies','Azure Monitor agent and a DCR, plus the dependency data for the Map'],
['**Storage insights**','Capacity, availability, latency and failures','Platform metrics'],
['**Network insights**','Topology and health of network resources','Network Watcher'],
['**Container insights**','Cluster and container performance','Agent on the cluster']]},
{h:'Enable VM insights'},
{flow:['Open the VM, Insights','Choose Enable and pick a Log Analytics workspace','Choose or create a data collection rule','Wait for data to appear','Use Performance and Map views']},
{note:'Insights help you see whether a problem is the VM, the storage or the network. Use them during triage before writing queries.'}],
src:[['VM insights',K.MON+'vm/vminsights-overview'],['Storage insights',K.STOR+'common/storage-insights-overview']]};

/* ---------- 7 ---------- */
L['az:12:7']={blocks:[
{p:'**Network Watcher** provides network diagnostics and monitoring, and **Connection Monitor** measures reachability and latency between endpoints over time.'},
{t:[['Tool','Purpose'],
['**Connection Monitor**','Continuous tests between VMs, on premises and URLs, with latency and loss'],
['**Packet capture**','Capture traffic from a VM for analysis'],
['**IP flow verify, next hop, effective routes**','Point-in-time diagnostics (Section 11)'],
['**Topology**','A map of resources in a VNet'],
['**Flow logs**','Record traffic accepted or denied']]},
{h:'Flow logs'},
{p:'**NSG flow logs** record IP traffic through NSGs, and their retirement is planned with **virtual network flow logs** as the replacement, so use VNet flow logs for new work. Logs go to a storage account and can be analyzed with **Traffic Analytics**.'},
{code:`az network watcher connection-monitor create --name cm-web --resource-group rg-net --location westeurope --endpoint-source-name vm1 --endpoint-source-resource-id <vm-id> --endpoint-dest-name web --endpoint-dest-address www.contoso.com --test-config-name http --protocol Http --http-method GET --test-group-name tg1`},
{note:'Connection Monitor needs the Network Watcher agent extension on the source VMs, and Network Watcher enabled in the region.'}],
src:[['Connection Monitor',K.D+'network-watcher/connection-monitor-overview'],['VNet flow logs',K.D+'network-watcher/vnet-flow-logs-overview']]};

/* ---------- 8 ---------- */
L['az:12:8']={blocks:[
{p:'Monitor a VM and create an alert that sends you an email when CPU is high.'},
{flow:['Create a Log Analytics workspace','Enable VM insights with the Azure Monitor agent','Create an action group with your email','Create a metric alert for CPU above 80 percent','Generate CPU load on the VM','Confirm the alert fires and review it']},
{code:`az monitor log-analytics workspace create -g rg-mon -n law-lab
az monitor action-group create -g rg-mon -n ag-lab --short-name lab --action email me me@contoso.com
az monitor metrics alert create -g rg-mon -n cpu-high --scopes <vm-id> --condition "avg Percentage CPU > 80" --window-size 5m --evaluation-frequency 1m --action ag-lab
# on the VM (Linux)
yes > /dev/null &`},
{h:'Observe'},
{t:[['Where','What'],
['Metrics Explorer','CPU line climbs'],
['Alerts','A fired alert with state New'],
['Email','Notification from the action group'],
['Log Analytics','Perf table receives counters']]},
{note:'Stop the load, resolve the alert and delete the lab resources. Log Analytics ingestion is billed by volume.'}],
src:[['Tutorial: create a metric alert',K.MON+'alerts/tutorial-metric-alert']]};

})();
