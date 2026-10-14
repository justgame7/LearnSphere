# LearnSphere content review checklist

Content added in the Key concepts, maps and cloud work was written from product knowledge and has **not been run against real systems**.
Use this list to verify the highest-risk statements before the content is treated as final. Mark each item `[x]` when checked.

How to check: run the command or read the vendor documentation for **your exact version**, then correct the file named in each section.
The `see` links, map layouts and lecture indexes are validated automatically. Only factual claims need a human review.

## PostgreSQL (`docs/pg-ref.js`, `docs/pg-aws.js`)

### Amazon RDS and Aurora section (`pg-aws.js`, quick reference pages 3 to 7 of `pg-ref.js`)
- [ ] Typical failover times (Multi-AZ instance 60 to 120 s, Multi-AZ DB cluster about 35 s, Aurora tens of seconds) against current AWS documentation
- [ ] Maximum storage (RDS 64 TiB, Aurora 128 TiB), read replica limit (15), backup retention (1 to 35 days)
- [ ] Aurora quorum description (6 copies, 2 per AZ, write 4 of 6, read 3 of 6)
- [ ] `shared_buffers` defaults (RDS about 25 percent, Aurora about 75 percent) and the formula parameters (`max_connections`, `effective_cache_size`, `maintenance_work_mem`)
- [ ] `rds.*` parameter names and types: `rds.force_ssl`, `rds.logical_replication`, `rds.log_retention_period`, `rds.restrict_password_commands`, `rds.rds_superuser_reserved_connections`, `rds.allowed_extensions`, `rds.adaptive_autovacuum`, `rds.pg_stat_ramdisk_size`
- [ ] Static vs dynamic classification of parameters (page "AWS: parameters and roles")
- [ ] AWS CLI flags: `--manage-master-user-password`, `--enable-cloudwatch-logs-exports`, `--cloudwatch-logs-export-configuration`, `--restore-type copy-on-write`, `--serverless-v2-scaling-configuration`, `--storage-type aurora-iopt1`
- [ ] Aurora Serverless v2 capacity range (minimum and maximum ACUs) and scale-to-zero availability
- [ ] Blue/Green deployment requirements and typical switchover time
- [ ] Performance Insights vs CloudWatch Database Insights naming and availability
- [ ] Stopped instance restart after 7 days, IAM token validity (15 minutes), storage modification cooldown
- [ ] Aurora function names: `aurora_version()`, `aurora_replica_status()`, `aurora_stat_get_db_commit_latency()`
- [ ] Extension list claims (`pg_cron`, `pgaudit`, `pg_hint_plan`, `aws_s3`) for your engine version

### Other PostgreSQL maps (`pg-ref.js`)
- [ ] Version-specific statements in the Upgrade paths and Configuration precedence maps (versions 15 to 18)

## Oracle sub-courses (`docs/ora-ref-*.js`)

### Core DBA (`ora-ref-core.js`)
- [ ] ORA error numbers and message text used in the Process maps (ORA-01555, ORA-12514, ORA-01078 and others)
- [ ] LREG registration timing and PDB open/save-state steps

### Backup and Recovery (`ora-ref-bkp.js`)
- [ ] Default of `CONTROLFILE AUTOBACKUP` (the text avoids stating a default)
- [ ] Retention default (`REDUNDANCY 1`), `ARCHIVELOG DELETION POLICY` default, `CONTROL_FILE_RECORD_KEEP_TIME` (7)
- [ ] Block media recovery syntax (`RECOVER CORRUPTION LIST`) and `DUPLICATE ... FOR STANDBY`
- [ ] PDB point-in-time recovery requirements (auxiliary destination vs local undo)

### Data Guard (`ora-ref-dg.js`)
- [ ] `NET_TIMEOUT` behaviour in Maximum Availability, Fast Sync (`SYNC NOAFFIRM`) description
- [ ] `FastStartFailoverThreshold` and `FastStartFailoverLagLimit` defaults
- [ ] `RECOVER STANDBY DATABASE FROM SERVICE` syntax (18c and later)
- [ ] Standby-first patch apply sequence (datapatch on the primary after switchover)
- [ ] Error numbers: ORA-16191, ORA-16057, ORA-16401, ORA-16810

### RAC (`ora-ref-rac.js`)
- [ ] `misscount` (30 s) and `disktimeout` defaults, reboot-less fencing description
- [ ] Flex ASM cardinality default (3), `DISK_REPAIR_TIME` default (12 hours)
- [ ] Policy-managed database desupport statement for 26ai
- [ ] `opatchauto` flags and `crsctl` / `srvctl` syntax for your release

### GoldenGate (`ora-ref-gg.js`)
- [ ] Admin Client syntax: `REGISTER EXTRACT`, `ADD REPLICAT ... PARALLEL`, `ADD CHECKPOINTTABLE`, `START REPLICAT ... AFTERCSN`, `ALTER REPLICAT ... EXTSEQNO`
- [ ] CDR `RESOLVECONFLICT` and `COMPARECOLS` syntax, `DBOPTIONS SETTAG` / `TRANLOGOPTIONS EXCLUDETAG`
- [ ] Deployment directory names (`var/lib/data`, `var/lib/checkpt`, `var/lib/wallet`)
- [ ] Distribution path steps (described in the UI, not by command)

### Performance and Tuning (`ora-ref-perf.js`)
- [ ] Licensing statements (Diagnostics and Tuning Packs, privilege analysis)
- [ ] AWR defaults (60 minutes, 8 days) and ASH behaviour
- [ ] `DBMS_SPM`, `DBMS_SQLDIAG`, `DBMS_SQLQ` call syntax for your release

### Security (`ora-ref-sec.js`)
- [ ] `DBMS_SQL_FIREWALL` calls and the schema-level privilege syntax (26ai)
- [ ] TDE: `WALLET_ROOT`, `TDE_CONFIGURATION`, `ENCRYPT ONLINE` clause for your release
- [ ] Unified audit mandatory actions and predefined policy names (`ORA_SECURECONFIG`, `ORA_LOGON_FAILURES`)
- [ ] Licensing of Advanced Security, Database Vault, Label Security, Data Redaction

### Upgrade and Patching (`ora-ref-upg.js`)
- [ ] 19c to 26ai direct upgrade path and the desupported feature list (non-CDB, GIMR, policy-managed RAC)
- [ ] 2026 CSPU / CPU cadence wording
- [ ] AutoUpgrade mode names and flags (`-mode analyze|fixups|deploy|upgrade`, `-patch`, `-restore`)
- [ ] Release names (long-term vs innovation) and support dates

### Exadata (`ora-ref-exa.js`)
- [ ] Storage server type names and generation naming (X9M, X10M, X11M)
- [ ] `patchmgr` options and the documented patch order for your release
- [ ] `escli` commands (Exascale) and `ALTER IORMPLAN` syntax
- [ ] Smart Scan statistic names and AI Smart Scan availability

## MongoDB (`docs/mongo-ref.js`)
- [ ] Defaults used in the Big-picture and Process maps (election timeout, oplog window, balancer, journal commit interval)
- [ ] Version-specific features (transactions on sharded clusters, retryable writes, change streams options)

## Amazon Redshift (`docs/rs-ref.js`)
- [ ] Node type and slice counts, Serverless base capacity range and defaults
- [ ] Automated snapshot interval and retention range, concurrency scaling free credits
- [ ] `MERGE` availability, auto-copy availability, Multi-AZ behaviour
- [ ] View and column names used in queries (`SYS_QUERY_HISTORY`, `SVV_TABLE_INFO`, `STL_LOAD_ERRORS`, `SYS_SERVERLESS_USAGE`)

## Kubernetes (`docs/k8s-ref.js`)
- [ ] Default ports and paths (6443, 2379/2380, 10250, 10257/10259, `/etc/kubernetes/pki`, manifests directory)
- [ ] kubeadm certificate lifetime and upgrade skew policy for your target version
- [ ] `kubectl debug`, ValidatingAdmissionPolicy and Gateway API object names against the current API versions

## Docker (`docs/docker-ref.js`)
- [ ] Swarm ports (2377, 7946, 4789), daemon TLS port 2376
- [ ] Exit-code meanings (125, 126, 127, 137, 139, 143)
- [ ] `docker scout`, `buildx imagetools`, Compose `depends_on` condition syntax for your Engine and Compose versions

## Terraform (`docs/tf-ref.js`)
- [ ] `import` block, `-generate-config-out`, `removed` block, ephemeral values and write-only arguments: minimum Terraform versions
- [ ] Variable precedence order and `-detailed-exitcode` meanings (0, 1, 2)
- [ ] S3 native locking availability (`use_lockfile`) for the version you teach

## Ansible (`docs/ansible-ref.js`)
- [ ] Variable precedence statements (extra vars win, role defaults lowest)
- [ ] Module names under `ansible.builtin` (`systemd_service`, `package`) for ansible-core 2.16+
- [ ] AWX CLI examples and execution environment commands (`ansible-navigator`)

## Prometheus and Grafana (`docs/prom-ref.js`)
- [ ] Default ports (9090, 9093, 9094, 9100, 9115, 9091, 3100, 3200) and retention default (15d)
- [ ] PromQL examples run unchanged on Prometheus 2.x and 3.x (check `histogram_quantile`, `predict_linear`)
- [ ] `amtool` and `promtool` command syntax, and kube-prometheus-stack object names (ServiceMonitor, PrometheusRule)

## SQL Server sub-courses (`docs/mss-ref-*.js`)
- [ ] DMV and catalog view names exist in 2019 and 2022 (`sys.dm_db_log_info`, `sys.dm_hadr_*`, `sys.query_store_*`)
- [ ] Defaults and recommendations (max server memory, MAXDOP, cost threshold, backup compression, tempdb files)
- [ ] Backup, TDE and AG commands (`WITH STOPAT`, `BACKUP CERTIFICATE`, `ALTER AVAILABILITY GROUP ... FAILOVER`) on a scratch instance
- [ ] Azure SQL statements: Entra authentication syntax, Log Replay Service commands and `az sql` parameters against the current CLI
- [ ] Edition limits for Basic Availability Groups, distributed AGs and readable secondaries

## DevOps and CI/CD (`docs/devops-*.js`)
- [ ] GitHub Actions: action major versions (`checkout@v4`, `upload-artifact@v4`, `attest-build-provenance@v2`, `trivy-action@0.28.0`), the pinned checkout SHA comment, current runner labels and the current billing and pricing page (it changed recently)
- [ ] GitLab CI/CD: `rules`, `needs`, `id_tokens`, CI/CD component syntax and merge train settings on your GitLab version
- [ ] Jenkins: supported Java versions for current LTS (lesson says 21, with 25 on newer lines), `jenkins/jenkins:lts-jdk21` tag, plugin names
- [ ] Argo CD and Flux: install manifest URL, `ApplicationSet` generators, `flux bootstrap` flags, Argo Rollouts analysis syntax
- [ ] OIDC: subject claim formats and cloud trust-policy JSON for AWS, Azure and Google Cloud
- [ ] cosign keyless flags, `--certificate-identity-regexp`, SLSA level wording and `gh attestation verify`
- [ ] Terraform S3 backend `use_lockfile` (Terraform 1.10 or later) and `-detailed-exitcode` meanings

## Azure Administrator (`docs/az-*.js`)
- [ ] Retirement and policy dates stated in lessons: mandatory MFA phases, default outbound access (private subnets for new VNets), Basic public IP and Basic load balancer retirement, NSG flow logs replaced by VNet flow logs, Log Analytics agent retirement, Automation Update Management retirement
- [ ] Portal paths and CLI flags (`az storage account or-policy`, `az maintenance configuration`, `az network bastion`, `az containerapp`) against the current Azure CLI
- [ ] Limits and numbers: five reserved addresses per subnet, 50 tags, management group depth, soft delete defaults (blobs, vault 14 days), archive rehydration times, Bastion SKU features
- [ ] Azure Disk Encryption retirement wording and encryption at host recommendation
- [ ] Built-in policy ID for Allowed locations (`e56962a6-4747-49cd-b67b-bf8b01975c4c`) and the Microsoft Learn links in lesson `src` lists
- [ ] AZ-104 skills-measured weights quoted in the overview lecture against the current study guide

## AWS Administrator (`docs/aws-*.js`)
- [ ] Free Tier and credit rules for new accounts and current Support plan names (lesson 1.8)
- [ ] Service limits quoted: 5 reserved subnet addresses, gp3 3,000 IOPS and 125 MiB/s baseline, S3 request rates per prefix, 35 day RDS backup retention, 7 instances per AZ in spread groups
- [ ] Public IPv4 charge, S3 default SSE-S3 and ACLs disabled by default, Inspector Classic retirement wording
- [ ] CLI syntax (`aws ec2`, `aws rds`, `aws backup`, `aws ssm`, `aws eks`) against the current AWS CLI v2
- [ ] SOA-C03 domain weights in the overview lecture against the current exam guide
- [ ] AWS documentation links in lesson `src` lists


## Generic items for every course
- [ ] Every command in a `chk` or `c` field runs on a scratch system without side effects (they are read-only unless the text says otherwise)
- [ ] Version and edition notes still match the course version in the course title
- [ ] Links in lesson `src` lists open (AWS and vendor documentation URLs move)
