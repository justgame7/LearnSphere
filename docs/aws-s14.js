/* LearnSphere - AWS Administrator, Section 14: Monitoring, Logging & Events.
   Lectures 0-9 are core; additional lectures (not written yet) follow. Needs aws-common.js. */
(function(){
const K=window.AW,L=window.LESSONS;

const pillars=K.dg(700,200,[
[10,10,680,180,'Telemetry and the services that handle it',1],
[25,55,150,70,'Metrics|numbers over time|CloudWatch Metrics',2],[200,55,150,70,'Logs|events and text|CloudWatch Logs',0],[375,55,150,70,'Traces|request paths|X-Ray',0],[550,55,125,70,'Events|state changes|EventBridge',0],
[25,140,650,35,'API activity is separate: CloudTrail records who called which API',0]],
[]);

const alarm=K.dg(700,200,[
[10,10,680,180,'From metric to action',1],
[25,60,120,60,'Metric|data points',0],[175,60,130,60,'Alarm|threshold and periods',2],[335,60,110,60,'State|OK, ALARM,|INSUFFICIENT',0],[475,60,200,60,'Action|SNS, Auto Scaling,|EC2, Systems Manager',0]],
[[145,90,175,90],[305,90,335,90],[445,90,475,90]]);

const eb=K.dg(700,210,[
[10,10,680,190,'EventBridge',1],
[25,70,120,60,'Event sources|AWS, SaaS, custom',0],[185,70,120,60,'Event bus|default or custom',2],[345,70,130,60,'Rules|pattern or schedule',0],[515,40,150,40,'Lambda, SNS, SQS',0],[515,100,150,40,'Step Functions, SSM',0]],
[[145,100,185,100],[305,100,345,100],[475,100,515,60],[475,100,515,120]]);

/* ---------- 0 ---------- */
L['aws:13:0']={blocks:[
{p:'**Observability** means being able to explain system behaviour from its outputs. AWS separates these outputs into metrics, logs, traces and events.'},
{svg:pillars},
{h:'CloudWatch metric terms'},
{t:[['Term','Meaning'],
['Namespace','A container for metrics such as AWS/EC2 or a custom namespace'],
['Metric','A time-ordered set of data points, for example CPUUtilization'],
['Dimension','A name-value pair that identifies a series, for example InstanceId'],
['Period','The length of time over which a statistic is computed'],
['Statistic','Average, Sum, Minimum, Maximum, SampleCount, percentiles'],
['Resolution','Standard 1 minute, or high resolution down to 1 second']]},
{h:'Default metric frequency'},
{ul:['Many services publish at **1 or 5 minute** granularity. EC2 basic monitoring is 5 minutes, detailed monitoring is 1 minute.','Metrics are kept for up to **15 months**, rolling up older data.']},
{code:`aws cloudwatch list-metrics --namespace AWS/EC2 --metric-name CPUUtilization
aws cloudwatch put-metric-data --namespace MyApp --metric-name Orders --value 12 --dimensions Env=prod
aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization \\
  --dimensions Name=InstanceId,Value=i-0abc --statistics Average Maximum --period 300 \\
  --start-time 2026-10-15T00:00:00Z --end-time 2026-10-15T01:00:00Z`}],
src:[['CloudWatch metrics',K.CW+'working_with_metrics.html']]};

/* ---------- 1 ---------- */
L['aws:13:1']={blocks:[
{p:'The **CloudWatch agent** collects what AWS cannot see from outside the instance: **memory, disk space, swap, processes** and **log files**. It runs on EC2, on-premises servers and in containers.'},
{h:'Install and configure'},
{flow:['Attach a role with the CloudWatchAgentServerPolicy to the instance','Install the agent package, or use Systems Manager Distributor','Create a JSON configuration with metrics and log files, or store it in Parameter Store','Start the agent with that configuration','Confirm metrics in the CWAgent namespace and logs in the log group']},
{code:`{
  "metrics": {
    "append_dimensions": {"InstanceId": "\${aws:InstanceId}"},
    "metrics_collected": {
      "mem": {"measurement": ["mem_used_percent"]},
      "disk": {"measurement": ["used_percent"], "resources": ["/"]}
    }
  },
  "logs": {"logs_collected": {"files": {"collect_list": [
    {"file_path": "/var/log/messages", "log_group_name": "/ec2/messages", "retention_in_days": 30}]}}}
}`},
{code:`sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 \\
  -c ssm:AmazonCloudWatch-linux -s`},
{note:'Containers use the agent or Fluent Bit as a daemon or sidecar. If no data arrives, check the role, the agent status and outbound access to CloudWatch endpoints.'}],
src:[['CloudWatch agent',K.CW+'Install-CloudWatch-Agent.html']]};

/* ---------- 2 ---------- */
L['aws:13:2']={blocks:[
{p:'**CloudWatch Logs** stores log events in **log groups** and **log streams**. You control retention and can turn log patterns into metrics.'},
{t:[['Feature','Use'],
['Log group','Container with retention, encryption and access settings'],
['Log stream','Sequence of events from one source'],
['Retention','Default is **never expire**. Set a period'],
['Metric filter','Count matches of a pattern as a metric, then alarm'],
['Subscription filter','Stream matching events in real time to Lambda, Kinesis or Firehose'],
['Export or S3 delivery','Long-term, low-cost storage']]},
{code:`aws logs put-retention-policy --log-group-name /app/web --retention-in-days 30
aws logs put-metric-filter --log-group-name /app/web --filter-name errors \\
  --filter-pattern '"ERROR"' --metric-transformations metricName=AppErrors,metricNamespace=MyApp,metricValue=1
aws logs put-subscription-filter --log-group-name /app/web --filter-name to-firehose \\
  --filter-pattern "" --destination-arn <arn> --role-arn <role>`},
{note:'Log groups with no retention grow forever. A weekly check for groups without retention is a quick cost win.'}],
src:[['CloudWatch Logs',K.CWL+'WhatIsCloudWatchLogs.html']]};

/* ---------- 3 ---------- */
L['aws:13:3']={blocks:[
{p:'**CloudWatch Logs Insights** queries log data interactively with a small query language.'},
{h:'Basic commands'},
{t:[['Command','Use'],
['fields','Choose fields to show'],
['filter','Keep matching events'],
['stats','Aggregate (count, avg, sum) optionally by field or time bin'],
['sort, limit','Order and cap results'],
['parse','Extract fields from text'],
['bin()','Group by time period']]},
{code:`fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 20

fields @timestamp
| filter status >= 500
| stats count() as errors by bin(5m)

parse @message "user=* action=* latency=*ms" as user, action, latency
| stats avg(latency), max(latency) by action`},
{ul:['Select the **log groups** and time range first. Queries scan what you select, and cost is per GB scanned.','Save useful queries and add them to dashboards.','JSON logs are parsed automatically, so fields are directly available.']},
{note:'Structured (JSON) logging makes every later analysis easier. Ask application teams for it.'}],
src:[['Logs Insights query syntax',K.CWL+'CWL_QuerySyntax.html']]};

/* ---------- 4 ---------- */
L['aws:13:4']={blocks:[
{p:'A **CloudWatch alarm** watches a metric and changes state when it crosses a threshold for a number of periods.'},
{svg:alarm},
{t:[['Type','How it triggers'],
['Static threshold','Metric above or below a fixed number'],
['Anomaly detection','Metric leaves an expected band learned from history'],
['Composite','Combines alarm states with AND, OR, NOT to reduce noise'],
['Metric math','Alarm on a calculation such as an error rate']]},
{h:'Important settings'},
{ul:['**Period** and **evaluation periods** (and **datapoints to alarm**) define sensitivity.','**Missing data treatment**: notBreaching, breaching, ignore or missing. Choose per metric.','**Actions**: SNS notification, Auto Scaling policy, EC2 stop, terminate, reboot or recover, or Systems Manager OpsItem.']},
{code:`aws cloudwatch put-metric-alarm --alarm-name web-5xx --namespace AWS/ApplicationELB \\
  --metric-name HTTPCode_Target_5XX_Count --dimensions Name=LoadBalancer,Value=app/web/abc \\
  --statistic Sum --period 60 --evaluation-periods 3 --datapoints-to-alarm 2 --threshold 20 \\
  --comparison-operator GreaterThanThreshold --treat-missing-data notBreaching --alarm-actions <sns-arn>`},
{note:'An alarm that fires too often is ignored. Use composite alarms and sensible thresholds so each page needs action.'}],
src:[['CloudWatch alarms',K.CW+'AlarmThatSendsEmail.html']]};

/* ---------- 5 ---------- */
L['aws:13:5']={blocks:[
{p:'**Amazon SNS** is a publish and subscribe notification service. A **topic** receives messages and delivers them to **subscribers**.'},
{t:[['Subscriber','Use'],
['Email, SMS, mobile push','People'],
['HTTP or HTTPS','Webhooks'],
['SQS','Reliable processing and fan-out'],
['Lambda','Automated response'],
['Firehose','Archiving and analytics']]},
{h:'Operations'},
{ul:['Subscribers must **confirm** email and HTTP subscriptions.','**Filter policies** let a subscriber receive only matching messages.','**Topic policy** allows services such as CloudWatch and EventBridge to publish.','Encrypt a topic with KMS. Make sure the service principal can use the key.','Failed deliveries can go to a **dead-letter queue**.']},
{code:`aws sns create-topic --name ops-alerts
aws sns subscribe --topic-arn <arn> --protocol email --notification-endpoint ops@example.com
aws sns publish --topic-arn <arn> --subject test --message "hello"`},
{note:'If an alarm fires but nobody is notified, check the subscription is confirmed, the topic policy allows the publisher and the KMS key policy allows it.'}],
src:[['Amazon SNS','https://docs.aws.amazon.com/sns/latest/dg/welcome.html']]};

/* ---------- 6 ---------- */
L['aws:13:6']={blocks:[
{p:'**CloudWatch dashboards** show metrics, logs and alarms in one view. They can combine **multiple Regions and accounts**.'},
{h:'Cross-account and cross-Region'},
{flow:['In each monitored (source) account, enable sharing with the monitoring account','In the monitoring account, open CloudWatch settings and link source accounts or the organization','Build widgets that choose the account and Region','Share the dashboard with specific people or publicly through a link if appropriate']},
{h:'Useful widgets'},
{ul:['Alarm status widgets for a service at a glance.','Metric math for error rate or saturation.','Logs Insights tables and counters.','Text widgets for runbook links.']},
{code:`aws cloudwatch put-dashboard --dashboard-name web-prod --dashboard-body file://dashboard.json
aws cloudwatch list-dashboards`},
{note:'A good dashboard answers "is it working" first, then "why not". Put golden signals at the top: traffic, errors, latency and saturation.'}],
src:[['Cross-account observability',K.CW+'CloudWatch-Unified-Cross-Account.html']]};

/* ---------- 7 ---------- */
L['aws:13:7']={blocks:[
{p:'**Amazon EventBridge** routes events from AWS services, your applications and SaaS partners to targets using **rules**. It also runs scheduled rules.'},
{svg:eb},
{h:'Rule anatomy'},
{code:`{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": {"state": ["terminated"]}
}`},
{ul:['**Event bus**: default (AWS events) or custom and partner buses.','**Rule**: an event pattern or a schedule.','**Target**: Lambda, SNS, SQS, Step Functions, Systems Manager and many more, with optional input transformation.','**Archive and replay** let you re-run past events.','**S3 event notifications** can send to EventBridge when enabled on the bucket.']},
{h:'Rule does not fire?'},
{flow:['Confirm the event actually occurred (CloudTrail for API events)','Test the pattern with the sandbox or Test event pattern','Check the rule is enabled and on the right bus and Region','Check the target permission (resource policy or role)','Look at FailedInvocations and TriggeredRules metrics, and the target DLQ']},
{note:'Events from CloudTrail API calls appear on the default bus only in the Region where the call happened. Global services such as IAM log in us-east-1.'}],
src:[['Amazon EventBridge','https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html']]};

/* ---------- 8 ---------- */
L['aws:13:8']={blocks:[
{p:'**AWS CloudTrail** records API calls and console actions in your account. It answers **who did what, when and from where**.'},
{t:[['Feature','Detail'],
['Event history','Last 90 days of management events, searchable, no setup'],
['Trail','Delivers events to S3 (and optionally CloudWatch Logs), kept as long as you want. A multi-Region organization trail covers all'],
['Event types','Management (control plane), data (S3 objects, Lambda invokes) and Insights (unusual activity)'],
['CloudTrail Lake','Managed event data store queryable with SQL'],
['Log file validation','Signed digest files prove logs were not altered']]},
{code:`aws cloudtrail create-trail --name org-trail --s3-bucket-name my-trail-logs --is-multi-region-trail --enable-log-file-validation
aws cloudtrail start-logging --name org-trail
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteBucket --max-results 5
aws cloudtrail validate-logs --trail-arn <arn> --start-time 2026-10-01T00:00:00Z`},
{h:'Operational practice'},
{ul:['Create an **organization trail** to a protected log archive account.','Enable data events only where needed, as they are high volume and billed.','Alarm on sensitive calls: root login, IAM changes, security group changes, trail changes.']},
{note:'Event history is not a substitute for a trail. Without a trail you lose events after 90 days and have no data events.'}],
src:[['AWS CloudTrail','https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html']]};

/* ---------- 9 ---------- */
L['aws:13:9']={blocks:[
{p:'**Practical:** monitor a workload and alert on a failure.'},
{flow:['Install the CloudWatch agent on an instance to collect memory and a log file','Create a metric filter on the log for the word ERROR','Build a dashboard with CPU, memory and the error count','Create alarms on error count and memory that notify an SNS topic','Generate errors and fill memory to trigger them','Use Logs Insights to find the failing component','Look up the instance stop event in CloudTrail and delete the resources']},
{t:[['Check','Expected'],
['Agent metrics','CWAgent namespace appears'],
['Alarm','Moves to ALARM then OK after recovery'],
['Email','Message from the SNS topic arrives'],
['CloudTrail','Event history lists the API calls you made']]},
{note:'Set log group retention for the lab so test data does not remain indefinitely.'}],
src:[['CloudWatch getting started',K.CW+'GettingStarted.html']]};
})();
