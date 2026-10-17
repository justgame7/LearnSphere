/* LearnSphere - Google Cloud, Section 07: Compute Engine.
   Lectures 0-10 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const families=K.dg(700,300,[
[10,10,680,280,'Machine families',1],
[30,50,150,100,'General purpose|E2, N2, N4, C3, C4, Tau|web, apps, databases',2],
[200,50,150,100,'Compute-optimized|C2, H3|HPC, gaming',0],
[370,50,150,100,'Memory-optimized|M-series, X4|SAP HANA, in-memory',0],
[540,50,130,100,'Accelerator|A and G series|GPUs for AI',0],
[30,175,640,80,'Machine type = family + series + size, for example n2-standard-4 or a custom type',2]],
[]);

const lifecycle=K.dg(700,200,[
[10,10,680,180,'VM states',1],
[30,70,100,60,'Provisioning',0],[165,70,100,60,'Staging',0],[300,70,100,60,'Running',2],[435,70,100,60,'Stopping',0],[570,70,100,60,'Terminated',0]],
[[130,100,165,100],[265,100,300,100],[400,100,435,100],[535,100,570,100],[570,110,400,110]]);

const mig=K.dg(700,260,[
[10,10,680,240,'Managed instance group',1],
[30,90,140,70,'Instance template|machine, disk, startup',2],[230,90,140,70,'MIG|size, autoscaler,|autohealing',2],[430,40,120,40,'VM zone a',0],[430,100,120,40,'VM zone b',0],[430,160,120,40,'VM zone c',0],[580,90,90,70,'Load|balancer',0]],
[[170,125,230,125],[370,110,430,60],[370,125,430,120],[370,140,430,180],[550,60,580,110],[550,120,580,125],[550,180,580,140]]);

const disks=K.dg(700,240,[
[10,10,680,220,'Block storage options',1],
[30,60,200,130,'Persistent Disk / Hyperdisk|network attached|survives VM stop|snapshots, resize',2],
[250,60,200,130,'Local SSD|physically attached|very fast|data lost on stop or delete',0],
[470,60,200,130,'Regional disk|replicated to two zones|failover between zones',0]],
[]);

/* ---------- 0 ---------- */
L['gcp:6:0']={blocks:[
{p:'**Compute Engine** is Google Cloud\'s Infrastructure-as-a-Service for virtual machines (VMs). You pick the CPU, memory, disk, operating system and network, and you manage the OS and software. It is the right choice when you need full control, lift-and-shift migrations or software that does not fit a container.'},
{svg:families},
{h:'Machine families and series'},
{t:[['Family','Series examples','Best for'],
['General purpose','E2 (cost-optimized, includes shared-core), N2 and N2D (balanced), N4, C3 and C4 (newer high performance), Tau T2D (scale-out), Arm-based series','Web servers, applications, small and medium databases, dev and test'],
['Compute-optimized','C2, C2D, H3','High per-core performance: HPC, gaming, media encoding'],
['Memory-optimized','M-series, X4','Large in-memory databases and analytics such as SAP HANA'],
['Storage-optimized','Z3','High local SSD throughput for scale-out databases'],
['Accelerator-optimized','A and G series','GPUs for training, inference and graphics']]},
{h:'Machine types'},
{ul:['**Predefined** types follow patterns: `standard` (about 4 GB per vCPU), `highmem` (about 8 GB), `highcpu` (about 1 GB). Example: `n2-standard-4`.','**Custom machine types** let you choose vCPUs and memory in supported series, to avoid paying for unused capacity.','**Shared-core** types (e2-micro, e2-small, e2-medium) burst for light workloads.','Extra vCPUs come with higher network bandwidth limits and disk limits.']},
{h:'Billing basics'},
{ul:['Billed per second with a one-minute minimum.','A stopped VM does not pay for vCPU and memory, but its disks and reserved IPs still cost.','Discounts: sustained use (some series), committed use and Spot (see the pricing lesson).']},
{code:`gcloud compute machine-types list --zones=us-central1-a --filter="name~^n2-standard"
gcloud compute instances create web-1 --zone=us-central1-a --machine-type=e2-medium
gcloud compute instances create custom-1 --zone=us-central1-a --custom-cpu=6 --custom-memory=20GB --custom-vm-type=n2`},
{note:'Choose the series first (performance, price, features such as Confidential VM support), then the size. Rightsizing recommendations help adjust later.'}],
src:[['Machine families',K.GCE+'machine-resource'],['Compute Engine overview',K.GCE+'instances']]};

/* ---------- 1 ---------- */
L['gcp:6:1']={blocks:[
{p:'Creating a VM means choosing a location, machine type, boot image, disks, network and identity. Each choice becomes a field you can also set in gcloud or Terraform.'},
{svg:lifecycle},
{h:'Create a VM'},
{code:`gcloud compute instances create web-1 \\
  --zone=us-central1-a --machine-type=e2-medium \\
  --image-family=debian-12 --image-project=debian-cloud \\
  --boot-disk-size=20GB --boot-disk-type=pd-balanced \\
  --subnet=web-us --no-address \\
  --service-account=web-backend@my-project.iam.gserviceaccount.com --scopes=cloud-platform \\
  --tags=web,ssh --metadata=enable-oslogin=TRUE
gcloud compute instances list
gcloud compute instances stop web-1 --zone=us-central1-a
gcloud compute instances delete web-1 --zone=us-central1-a`},
{h:'Images'},
{t:[['Image type','Description'],
['Public image','Debian, Ubuntu, Rocky, RHEL, SUSE, Windows Server, Container-Optimized OS. Some carry license charges'],
['Image family','A pointer to the latest image in a series, such as debian-12'],
['Custom image','Your own image built from a disk, snapshot or file, shared across projects'],
['Marketplace image','Third-party software preconfigured']]},
{h:'Connecting with SSH'},
{t:[['Method','How it works'],
['Browser SSH / gcloud compute ssh','Convenient. Keys are managed automatically'],
['OS Login','Uses IAM roles (roles/compute.osLogin or osAdminLogin) and your Google identity. Recommended, central control and audit'],
['IAP tunneling','`gcloud compute ssh vm --tunnel-through-iap` reaches VMs with no external IP via Identity-Aware Proxy'],
['Metadata keys','Public keys stored in metadata. Harder to manage at scale']]},
{code:`gcloud compute ssh web-1 --zone=us-central1-a --tunnel-through-iap
gcloud compute connect-to-serial-port web-1 --zone=us-central1-a   # if the network or SSH is broken`},
{note:'Prefer no external IP, OS Login and IAP. Enable OS Login across a project with the metadata key enable-oslogin=TRUE or an organization policy.'}],
src:[['Create a VM',K.GCE+'instances/create-start-instance'],['OS Login',K.GCE+'oslogin'],['Connect to VMs',K.GCE+'instances/connecting-to-instance']]};

/* ---------- 2 ---------- */
L['gcp:6:2']={blocks:[
{p:'VMs store data on block devices. Google Cloud offers network-attached disks that survive the VM, and local disks that do not.'},
{svg:disks},
{h:'Disk types'},
{t:[['Type','Medium','Use'],
['Persistent Disk Standard (pd-standard)','HDD','Sequential throughput, cheap bulk storage'],
['Persistent Disk Balanced (pd-balanced)','SSD','Default for most boot and data disks'],
['Persistent Disk SSD (pd-ssd)','SSD','Higher IOPS and lower latency databases'],
['Persistent Disk Extreme','SSD','Provisioned IOPS for the most demanding databases'],
['Hyperdisk (Balanced, Throughput, Extreme, ML)','Next generation block storage','Independently provisioned size, IOPS and throughput, newer machine series'],
['Local SSD','Physically attached NVMe','Scratch, caches, temp data. Very fast, not persistent']]},
{h:'Persistent disk features'},
{ul:['Independent of the VM: detach and attach to another VM in the same zone.','**Zonal** by default. **Regional** persistent disks replicate across two zones for failover.','Grow online. You can increase size but not shrink it.','Encrypted by default, with optional customer-managed keys (CMEK).','Up to 128 disks attached to many machine types, with per-VM limits on size and performance.','Read-only multi-attach is possible to serve shared data.']},
{h:'Common tasks'},
{code:`gcloud compute disks create data-1 --size=200GB --type=pd-balanced --zone=us-central1-a
gcloud compute instances attach-disk web-1 --disk=data-1 --zone=us-central1-a
gcloud compute disks resize data-1 --size=500GB --zone=us-central1-a

# inside the VM, format and mount a new disk
sudo mkfs.ext4 -m 0 -E lazy_itable_init=0,discard /dev/disk/by-id/google-data-1
sudo mkdir -p /mnt/data && sudo mount -o discard,defaults /dev/disk/by-id/google-data-1 /mnt/data
# after resizing a disk, grow the file system
sudo resize2fs /dev/sdb`},
{h:'Local SSD caution'},
{p:'Each Local SSD is 375 GB. Data survives reboots but is lost when the VM is stopped, preempted or deleted. Use it only for data you can recreate, or replicate to elsewhere.'},
{note:'Disk performance depends on size, type and the VM. A tiny VM cannot use a very fast disk fully. Check the performance limits table before choosing.'}],
src:[['Disks overview',K.GCE+'disks'],['Hyperdisk',K.GCE+'disks/hyperdisks']]};

/* ---------- 3 ---------- */
L['gcp:6:3']={blocks:[
{p:'Backups and golden images protect data and speed up deployment. Compute Engine offers snapshots, images and machine images, which are related but different.'},
{h:'Snapshots'},
{ul:['A snapshot captures the state of a **disk** at a point in time.','The first is full, later ones are **incremental**, storing only changes.','A snapshot is a **global** resource and can create a disk in any zone or region.','Take them from a running VM, ideally quiescing the file system for consistency.','**Snapshot schedules** automate creation and retention.']},
{code:`gcloud compute disks snapshot data-1 --zone=us-central1-a --snapshot-names=data-1-snap
gcloud compute resource-policies create snapshot-schedule daily-7 --region=us-central1 \\
  --max-retention-days=7 --daily-schedule --start-time=02:00
gcloud compute disks add-resource-policies data-1 --zone=us-central1-a --resource-policies=daily-7
gcloud compute disks create data-restore --source-snapshot=data-1-snap --zone=europe-west1-b`},
{h:'Images'},
{p:'An **image** is a template for a boot disk. Create one from a disk or snapshot, then use it to create many VMs. Group versions in an **image family**, so templates always use the latest.'},
{code:`gcloud compute images create web-golden-v3 --source-disk=web-1 --source-disk-zone=us-central1-a --family=web-golden
gcloud compute images add-iam-policy-binding web-golden-v3 --member="group:ops@example.com" --role="roles/compute.imageUser"`},
{h:'Machine images'},
{p:'A **machine image** stores the whole VM: configuration, metadata, permissions and the data from all attached disks. Use it to clone or back up entire VMs.'},
{h:'Compared'},
{t:[['Item','Captures','Best for'],
['Snapshot','One disk, incremental','Backups, restores, migrating a disk between zones'],
['Image','A boot disk template','Golden images for fleets'],
['Machine image','VM configuration plus all disks','Backup or clone of a whole VM']]},
{note:'Snapshots stored in multi-regional locations cost more than regional. Also set retention. Old snapshots build up silently.'}],
src:[['Snapshots',K.GCE+'disks/snapshots'],['Images',K.GCE+'images'],['Machine images',K.GCE+'machine-images']]};

/* ---------- 4 ---------- */
L['gcp:6:4']={blocks:[
{p:'**Metadata** is key-value data attached to a project or an instance. VMs read it from a **metadata server**, so you can configure machines at boot without baking values into images.'},
{h:'Where metadata lives'},
{t:[['Level','Applies to'],
['Project metadata','All VMs in the project (for example enable-oslogin)'],
['Instance metadata','One VM. Overrides project values'],
['Predefined keys','startup-script, shutdown-script, ssh-keys, enable-oslogin and others']]},
{h:'Startup and shutdown scripts'},
{code:`gcloud compute instances create web-1 --zone=us-central1-a \\
  --metadata=startup-script='#! /bin/bash
apt-get update && apt-get install -y nginx
echo "Hello from $(hostname)" > /var/www/html/index.html'
gcloud compute instances create web-2 --zone=us-central1-a --metadata-from-file=startup-script=startup.sh
gcloud compute instances add-metadata web-1 --zone=us-central1-a --metadata=env=prod`},
{ul:['The startup script runs as root at **every boot**, so make it idempotent.','`startup-script-url` can point to a script in Cloud Storage.','The `shutdown-script` has a limited time to finish on shutdown.']},
{h:'Reading metadata from inside the VM'},
{code:`curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/name
curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/env
curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token`},
{p:'The required header `Metadata-Flavor: Google` helps block simple request-forgery attacks. Applications use the token endpoint, usually through client libraries, to authenticate as the VM service account.'},
{h:'Service account and scopes'},
{ul:['A VM runs as one service account. Its roles decide what the VM can do.','Access scopes are a legacy second filter. Use `cloud-platform` and manage access with IAM.','Check the VM from inside: `gcloud auth list` shows the attached account.']},
{note:'Anyone who can run code on a VM can read its metadata and token. Keep roles on the VM service account minimal.'}],
src:[['About VM metadata',K.GCE+'metadata/overview'],['Startup scripts',K.GCE+'instances/startup-scripts/linux']]};

/* ---------- 5 ---------- */
L['gcp:6:5']={blocks:[
{p:'Running VMs one by one does not scale. An **instance template** defines a VM configuration once, and a **managed instance group (MIG)** keeps a fleet of identical VMs from that template, across zones if you choose.'},
{svg:mig},
{h:'Instance template'},
{p:'A template stores the machine type, boot disk image, labels, metadata, network and service account. Templates are immutable: to change something, create a new template and roll it out.'},
{code:`gcloud compute instance-templates create web-tpl-v1 --machine-type=e2-medium \\
  --image-family=debian-12 --image-project=debian-cloud --network=prod-vpc --subnet=web-us --region=us-central1 \\
  --no-address --tags=web --metadata-from-file=startup-script=startup.sh
gcloud compute instance-groups managed create web-mig --template=web-tpl-v1 --size=3 \\
  --region=us-central1 --zones=us-central1-a,us-central1-b,us-central1-c`},
{h:'Zonal and regional groups'},
{t:[['Type','Behaviour'],
['Zonal MIG','All VMs in one zone'],
['Regional MIG','VMs spread across up to three zones. Survives a zone failure. Recommended for production']]},
{h:'Rolling updates'},
{code:`gcloud compute instance-groups managed rolling-action start-update web-mig --region=us-central1 \\
  --version=template=web-tpl-v2 --max-surge=3 --max-unavailable=0
# canary: send 20 percent to the new version
gcloud compute instance-groups managed rolling-action start-update web-mig --region=us-central1 \\
  --version=template=web-tpl-v1 --canary-version=template=web-tpl-v2,target-size=20%`},
{ul:['**max surge** is how many extra VMs may exist during an update. **max unavailable** is how many may be down.','Update type **proactive** replaces VMs now. **Opportunistic** updates only when VMs are created.','A **stateful MIG** keeps disks and IPs for each instance, useful for databases or licensed apps.']},
{h:'Unmanaged groups'},
{p:'An unmanaged instance group is just a set of existing VMs for use by a load balancer. It has no template, autoscaling or healing.'},
{note:'Stateless web and API tiers belong in MIGs. Keep state in databases or buckets, so VMs are disposable.'}],
src:[['Managed instance groups',K.GCE+'instance-groups'],['Rolling updates',K.GCE+'instance-groups/updating-migs']]};

/* ---------- 6 ---------- */
L['gcp:6:6']={blocks:[
{p:'**Autoscaling** adds or removes VMs in a MIG as load changes. **Autohealing** replaces VMs that fail an application health check. Together they give elasticity and self-repair.'},
{h:'Autoscaling signals'},
{t:[['Signal','How it scales'],
['CPU utilization','Keeps average CPU near a target such as 60%'],
['Load balancing utilization','Based on the capacity setting of the backend service'],
['Cloud Monitoring metric','Any built-in or custom metric, per instance or per group, such as queue depth'],
['Schedule','Minimum size at defined times (for example business hours)'],
['Predictive autoscaling','Uses past patterns to add VMs before expected load']]},
{code:`gcloud compute instance-groups managed set-autoscaling web-mig --region=us-central1 \\
  --min-num-replicas=3 --max-num-replicas=12 --target-cpu-utilization=0.6 --cool-down-period=90
gcloud compute instance-groups managed describe web-mig --region=us-central1 --format="value(status.autoscaler)"`},
{ul:['**Cool-down period** gives new VMs time to initialize before their metrics count.','**Scale-in controls** limit how fast the group shrinks to avoid dropping capacity too quickly.','Set min to at least the number of zones for availability.','Quota can block scale-out, so set max within your quota.']},
{h:'Autohealing'},
{p:'Attach a **health check** to the MIG. If a VM fails the check repeatedly, the MIG recreates it. Set an **initial delay** longer than your boot and startup time so VMs are not killed while starting.'},
{code:`gcloud compute health-checks create http app-hc --port=8080 --request-path=/healthz
gcloud compute instance-groups managed update web-mig --region=us-central1 --health-check=app-hc --initial-delay=300`},
{h:'Autohealing versus load balancer health check'},
{t:[['Health check','Effect'],
['Load balancer','Stops sending traffic to an unhealthy backend'],
['MIG autohealing','Recreates the unhealthy VM']]},
{note:'Use separate, simple health endpoints. A check that depends on a database can cause a cascade where a DB outage makes every VM look unhealthy and get recreated.'}],
src:[['Autoscaling groups of instances',K.GCE+'autoscaler'],['Autohealing',K.GCE+'instance-groups/autohealing-instances-in-migs']]};

/* ---------- 7 ---------- */
L['gcp:6:7']={blocks:[
{p:'Beyond standard VMs, Compute Engine offers capacity options that trade price, isolation and certainty.'},
{h:'Spot VMs'},
{ul:['Large discount, often 60 to 91 percent, for spare capacity.','Google can **stop (preempt)** a Spot VM at any time with about 30 seconds notice.','No maximum run time (unlike old preemptible VMs, which stopped after 24 hours).','Good for batch jobs, CI, rendering, fault-tolerant data processing and stateless workers in a MIG.','Not for databases or anything that cannot be restarted.']},
{code:`gcloud compute instances create batch-1 --zone=us-central1-a --machine-type=e2-standard-4 \\
  --provisioning-model=SPOT --instance-termination-action=STOP`},
{h:'Sole-tenant nodes'},
{ul:['A **node** is a physical server dedicated to your projects. Only your VMs run on it.','Use for compliance isolation, licensing that is tied to physical cores, or workloads needing predictable performance.','Create a **node template**, then a **node group**, then place VMs using node affinity labels.']},
{h:'Reservations'},
{p:'A **reservation** holds capacity of a chosen machine type in a zone, so VMs can be created when needed, even in busy periods. You pay for reserved resources whether used or not, but committed use discounts can apply.'},
{code:`gcloud compute reservations create prod-res --zone=us-central1-a --vm-count=10 --machine-type=n2-standard-8
gcloud compute instances create res-vm --zone=us-central1-a --machine-type=n2-standard-8 --reservation-affinity=specific --reservation=prod-res`},
{h:'Security options'},
{t:[['Option','Provides'],
['Shielded VM','Secure boot, vTPM and integrity monitoring against boot-level tampering'],
['Confidential VM','Memory encryption in use on supported hardware'],
['Custom images with hardened OS','Reduce attack surface'],
['Organization policy','Control external IPs, images, OS Login and so on']]},
{h:'Choosing'},
{t:[['Need','Choice'],
['Cheap, interruptible compute','Spot VMs'],
['Dedicated hardware or BYOL','Sole-tenant nodes'],
['Guaranteed capacity','Reservations'],
['Protect data in memory','Confidential VMs']]}],
src:[['Spot VMs',K.GCE+'instances/spot'],['Sole-tenant nodes',K.GCE+'nodes/sole-tenant-nodes'],['Reservations',K.GCE+'instances/reservations-overview']]};

/* ---------- 8 ---------- */
L['gcp:6:8']={blocks:[
{p:'**VM Manager** is a set of tools to manage fleets of VMs: patch them, inventory their software and keep configuration consistent. It works through the **OS Config agent**, which is preinstalled on most Google images.'},
{h:'Components'},
{t:[['Feature','Purpose'],
['OS patch management','Schedule and run OS updates across many VMs, with maintenance windows, pre and post scripts, and reports'],
['OS inventory','See installed packages, OS version and available updates per VM'],
['OS policies (configuration management)','Describe the desired state (packages, files, repositories) and enforce it']]},
{h:'Enable and use'},
{code:`gcloud compute project-info add-metadata --metadata=enable-osconfig=TRUE
gcloud compute os-config patch-deployments create weekly-patch --file=patch.yaml
gcloud compute os-config patch-jobs execute --instance-filter-all --description="Run patching now"
gcloud compute os-config patch-jobs list`},
{p:'A patch deployment defines which VMs to patch (by zone, label or name), when (one-time or recurring), what to apply (all updates, security only, or exclusions), and how disruptive it may be (rolling in waves).'},
{h:'Patching approach'},
{flow:['Inventory shows which VMs are missing updates','Patch a test group first on a schedule','Review results and compliance reports','Roll to production in waves by zone or label','Use immutable images and MIG rolling updates as the long term approach']},
{note:'Patching in place suits long-lived VMs. For stateless fleets, rebuilding images and rolling the MIG is cleaner than patching each VM.'}],
src:[['VM Manager overview',K.GCE+'vm-manager'],['OS patch management',K.GCE+'os-patch-management']]};

/* ---------- 9 ---------- */
L['gcp:6:9']={blocks:[
{p:'Google must maintain its hosts. Compute Engine hides most of that using **live migration**, and gives you policies to control what happens when things go wrong.'},
{h:'Maintenance events'},
{ul:['**Live migration.** For most VMs, Google moves the running VM to another host with little or no interruption. The VM keeps its IP, disks and state.','**Terminate.** Some VMs (GPUs and certain special types) cannot live-migrate. They are stopped for maintenance, with notice.','**Host errors.** If a host fails, the VM is restarted automatically on another host if automatic restart is on.']},
{h:'Availability policies'},
{t:[['Setting','Values','Meaning'],
['On host maintenance','MIGRATE or TERMINATE','Live migrate during maintenance, or stop the VM'],
['Automatic restart','On or off','Restart after a crash or host failure'],
['Provisioning model','Standard or Spot','Spot has no automatic restart guarantee'],
['Maintenance window and notifications','Policy','Schedule planned maintenance for sole-tenant and some VMs']]},
{code:`gcloud compute instances set-scheduling web-1 --zone=us-central1-a --maintenance-policy=MIGRATE --restart-on-failure
gcloud compute instances describe web-1 --zone=us-central1-a --format="value(scheduling)"`},
{h:'Designing for availability'},
{ul:['Run at least two instances in different zones behind a load balancer.','Use regional MIGs with autohealing.','Use regional persistent disks or application-level replication for state.','Use the **Compute Engine SLA** terms for multiple zones as a design guide.','Plan for the 30-second shutdown signal on Spot VMs.']},
{note:'Live migration does not protect against software crashes or zone outages. It only covers host maintenance. Spread across zones for those.'}],
src:[['Live migration',K.GCE+'instances/live-migration-process'],['Set VM host maintenance policy',K.GCE+'instances/setting-vm-host-options']]};

/* ---------- 10 ---------- */
L['gcp:6:10']={blocks:[
{p:'Compute can be the largest part of a bill. Google Cloud has several discounts and recommendations that lower cost without changing the application.'},
{h:'Discount options'},
{t:[['Option','How it works','Best for'],
['Sustained use discounts','Automatic discount for some series (such as N1, N2) when VMs run a large part of the month. Not for E2','Steady workloads, no commitment'],
['Resource-based committed use discounts','1 or 3 year commitment to vCPU and memory in a region','Predictable, constant baseline'],
['Spend-based (flexible) committed use','Commit to an hourly spend, applies across eligible machine series and regions','Mixed or changing fleets'],
['Spot VMs','Deep discount, interruptible','Batch and fault-tolerant jobs'],
['Custom machine types','Pay only for the resources you need','Odd shaped workloads']]},
{h:'Rightsizing'},
{p:'**Rightsizing recommendations** appear in the console and via the Recommender API. They compare provisioned and used CPU and memory and suggest a smaller or different machine type. Idle VM recommendations find VMs with almost no use.'},
{code:`gcloud recommender recommendations list --project=my-project --location=us-central1-a \\
  --recommender=google.compute.instance.MachineTypeRecommender --format="table(name,primaryImpact.costProjection.cost.units)"
gcloud recommender recommendations list --project=my-project --location=us-central1-a --recommender=google.compute.instance.IdleResourceRecommender`},
{h:'Practical habits'},
{ul:['Stop or delete VMs you do not need. Schedule dev and test VMs to stop at night with instance schedules.','Delete orphaned disks, old snapshots and unused static IPs.','Use the cheapest suitable disk type. Balanced is fine for most workloads.','Pick regions with lower prices where latency allows.','Review commitment coverage quarterly.']},
{code:`gcloud compute resource-policies create instance-schedule office-hours --region=us-central1 \\
  --vm-start-schedule="0 8 * * 1-5" --vm-stop-schedule="0 19 * * 1-5" --timezone=Europe/London
gcloud compute instances add-resource-policies dev-1 --zone=us-central1-a --resource-policies=office-hours`},
{note:'Commitments cannot be cancelled. Commit only to the usage you are sure to keep and use Spot and autoscaling for the variable part.'}],
src:[['Committed use discounts','https://cloud.google.com/docs/cuds'],['Rightsizing recommendations',K.GCE+'instances/apply-machine-type-recommendations-for-instances']]};
})();
