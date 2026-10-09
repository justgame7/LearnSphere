/* LearnSphere - Terraform, Section 06: Expressions, Functions & Dynamic Configuration.
   Lectures 0-8 are core, 9-14 are additional content (not written yet). Needs tf-common.js. */
(function(){
const K=window.TF,L=window.LESSONS,LG=K.L;

/* ---------- diagrams ---------- */
const cnt=K.dg(700,190,[
[10,10,330,170,'count = 3 (identity = position)',1],[360,10,330,170,'for_each = {a,b,c} (identity = key)',1],
[30,50,90,40,'web[0]',0],[135,50,90,40,'web[1]',0],[240,50,90,40,'web[2]',0],[30,110,300,50,'Remove web[1]: web[2] becomes web[1]|Terraform sees a change (risky)',2],
[380,50,90,40,'web["a"]',0],[485,50,90,40,'web["b"]',0],[590,50,90,40,'web["c"]',0],[380,110,300,50,'Remove "b": only web["b"] is destroyed|a and c stay untouched (safe)',2]],
[]);

const fe=K.dg(700,170,[
[10,10,680,150,'for expression: data in, new data out',1],
[30,55,170,70,'Input|["web","db","cache"]',0],[265,55,170,70,'[for s in list : upper(s)]|transform each item',2],[500,55,170,70,'Output|["WEB","DB","CACHE"]',0]],
[[200,90,265,90],[435,90,500,90]]);

const dyn=K.dg(700,190,[
[10,10,680,170,'dynamic block: repeat a nested block from a collection',1],
[30,55,170,90,'var.ports|[80, 443, 8080]',0],[265,55,170,90,'dynamic "ingress" {|for_each = var.ports|content { ... } }',2],[500,55,170,90,'3 ingress blocks|port 80, 443, 8080',0]],
[[200,100,265,100],[435,100,500,100]]);

/* ---------- 0: Expressions ---------- */
L['tf:5:0']={blocks:[
{p:'An **expression** is anything that produces a value: a literal, a reference, a calculation or a function call. Terraform lets you use expressions almost anywhere on the right-hand side of an argument.'},
{h:'Operators'},
{t:[['Kind','Operators','Example','Result'],
['Arithmetic','`+ - * / %`','`var.count * 2`','number'],
['Comparison','`== != < <= > >=`','`var.env == "prod"`','bool'],
['Logical','`&& || !`','`var.a && !var.b`','bool'],
['Conditional','`condition ? a : b`','`var.env == "prod" ? 3 : 1`','a or b']]},
{h:'The conditional expression'},
{code:`instance_type = var.env == "prod" ? "m5.large" : "t3.micro"

# a common trick: create something only when a flag is true
resource "aws_eip" "web" {
  count = var.public ? 1 : 0
}`},
{p:'Both results must be the same type. `condition ? "a" : 1` is an error.'},
{h:'References: how to name a value'},
{t:[['You write','What it is'],
['`var.NAME`','Input variable'],
['`local.NAME`','Local value'],
['`TYPE.NAME.ATTR`','Attribute of a resource'],
['`data.TYPE.NAME.ATTR`','Attribute of a data source'],
['`module.NAME.OUTPUT`','Output of a child module'],
['`each.key`, `each.value`','Current item inside `for_each`'],
['`count.index`','Current number inside `count`'],
['`path.module`, `path.root`, `path.cwd`','Folder paths'],
['`terraform.workspace`','Current workspace name'],
['`self.ATTR`','The resource itself (in provisioners)']]},
{h:'String interpolation'},
{code:`name = "web-\${var.env}-\${count.index}"      # build text
tags = { Name = "\${local.prefix}-server" }

# a bare reference needs no quotes
ami  = data.aws_ami.ubuntu.id`},
{h:'Splat: one attribute from many'},
{code:`aws_instance.web[*].id            # list of every id (count)
[for i in aws_instance.web : i.id]   # same, longer form`},
{note:'Use `${ }` only to **mix** text and values. Writing `"\${var.name}"` alone is the old style; just write `var.name`.'}],
src:[['Expressions',LG+'expressions'],['Operators',LG+'expressions/operators'],['Conditionals',LG+'expressions/conditionals']]};

/* ---------- 1: Functions string numeric collection ---------- */
L['tf:5:1']={blocks:[
{p:'A **function** takes values and returns a value: `upper("web")` returns `"WEB"`. Terraform has about 100 built-in functions and **you cannot write your own**. The most used ones are below. Try each in `terraform console`.'},
{h:'String functions'},
{t:[['Function','Example','Result'],
['`upper` / `lower`','`upper("web")`','`"WEB"`'],
['`trimspace`','`trimspace("  hi  ")`','`"hi"`'],
['`replace`','`replace("a-b", "-", "_")`','`"a_b"`'],
['`split`','`split(",", "a,b,c")`','`["a","b","c"]`'],
['`join`','`join("-", ["a","b"])`','`"a-b"`'],
['`format`','`format("web-%02d", 3)`','`"web-03"`'],
['`substr`','`substr("abcdef", 0, 3)`','`"abc"`'],
['`startswith` / `endswith`','`startswith("prod-db", "prod")`','`true`'],
['`regex`','`regex("[0-9]+", "ab12")`','`"12"`']]},
{h:'Numeric functions'},
{t:[['Function','Example','Result'],
['`min` / `max`','`max(1, 5, 3)`','`5`'],
['`ceil` / `floor`','`ceil(1.2)`','`2`'],
['`abs`','`abs(-4)`','`4`'],
['`pow`','`pow(2, 3)`','`8`']]},
{h:'Collection functions'},
{t:[['Function','Example','Result'],
['`length`','`length(["a","b"])`','`2`'],
['`concat`','`concat(["a"], ["b"])`','`["a","b"]`'],
['`merge`','`merge({a=1}, {b=2})`','`{a=1,b=2}`'],
['`keys` / `values`','`keys({a=1,b=2})`','`["a","b"]`'],
['`lookup`','`lookup({a=1}, "b", 0)`','`0` (default)'],
['`contains`','`contains(["a","b"], "a")`','`true`'],
['`distinct`','`distinct(["a","a","b"])`','`["a","b"]`'],
['`flatten`','`flatten([["a"],["b","c"]])`','`["a","b","c"]`'],
['`element`','`element(["a","b"], 1)`','`"b"`'],
['`slice`','`slice(["a","b","c"], 0, 2)`','`["a","b"]`'],
['`sort`','`sort(["b","a"])`','`["a","b"]`'],
['`zipmap`','`zipmap(["a","b"], [1,2])`','`{a=1,b=2}`']]},
{h:'Try them'},
{code:`$ terraform console
> upper("web")
"WEB"
> merge({ env = "dev" }, { team = "ops" })
{
  "env" = "dev"
  "team" = "ops"
}
> format("%s-%s", "app", "dev")
"app-dev"`},
{note:'Functions never change real infrastructure; they only compute values while Terraform builds the plan.'}],
src:[['Built-in functions',LG+'functions']]};

/* ---------- 2: Functions encoding etc ---------- */
L['tf:5:2']={blocks:[
{p:'More functions you will meet in real configuration: converting data formats, reading files, working with time and calculating network addresses.'},
{h:'Encoding and decoding'},
{t:[['Function','Use','Example'],
['`jsonencode`','Value to JSON text (IAM policies!)','`jsonencode({a = 1})`'],
['`jsondecode`','JSON text to a value','`jsondecode("{\\"a\\":1}")`'],
['`yamlencode` / `yamldecode`','Same for YAML','`yamlencode({a = 1})`'],
['`base64encode` / `base64decode`','Encode text','`base64encode("hi")`']]},
{code:`resource "aws_iam_policy" "p" {
  name   = "read-s3"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject"]
      Resource = "*"
    }]
  })
}`},
{h:'Filesystem'},
{t:[['Function','Use'],
['`file("x.txt")`','Read a file as text'],
['`filebase64("x.bin")`','Read a file as base64'],
['`fileexists("x.txt")`','Check if it exists'],
['`templatefile("t.tpl", vars)`','Render a template (lecture 8)'],
['`path.module`','Folder of the current module, to build safe paths']]},
{code:`user_data = file("\${path.module}/scripts/init.sh")`},
{h:'Date and time'},
{t:[['Function','Example','Result'],
['`timestamp()`','`timestamp()`','`"2026-10-09T10:00:00Z"` (changes every run)'],
['`formatdate`','`formatdate("YYYY-MM-DD", timestamp())`','`"2026-10-09"`'],
['`timeadd`','`timeadd(timestamp(), "24h")`','Time one day later']]},
{p:'Careful: `timestamp()` changes every plan, so a resource using it always shows a change. For a stable time use the `time_static` resource.'},
{h:'IP network'},
{t:[['Function','Example','Result'],
['`cidrsubnet`','`cidrsubnet("10.0.0.0/16", 8, 2)`','`"10.0.2.0/24"`'],
['`cidrhost`','`cidrhost("10.0.2.0/24", 5)`','`"10.0.2.5"`'],
['`cidrnetmask`','`cidrnetmask("10.0.0.0/16")`','`"255.255.0.0"`']]},
{p:'`cidrsubnet(prefix, newbits, netnum)`: add `newbits` to the prefix length and pick subnet number `netnum`. `/16` plus 8 bits gives `/24` subnets.'},
{h:'Type conversion'},
{t:[['Function','Converts to'],
['`tostring`, `tonumber`, `tobool`','Primitive types'],
['`tolist`, `toset`, `tomap`','Collection types'],
['`try(a, b)`, `can(a)`','Handle errors safely']]},
{code:`toset(["a", "b", "a"])     # set with two items
tonumber("42")             # 42
try(var.cfg.port, 80)      # 80 if port is missing`},
{note:'Terraform converts types automatically when it is safe (the string "5" to the number 5 where a number is needed), but explicit conversion is clearer.'}],
src:[['Encoding',LG+'functions'],['Network functions',LG+'functions/cidrsubnet']]};

/* ---------- 3: count ---------- */
L['tf:5:3']={blocks:[
{p:'`count` is a meta-argument that creates **several copies** of one resource. Give it a number and Terraform makes that many instances.'},
{code:`resource "random_pet" "name" {
  count  = 3
  length = 2
}

output "names" {
  value = random_pet.name[*].id
}`},
{t:[['Item','Meaning'],
['`count = 3`','Three instances'],
['`count.index`','Current number, starting at 0'],
['`random_pet.name[0]`','One instance'],
['`random_pet.name[*].id`','List of all ids'],
['`count = 0`','Create none (a way to switch a resource off)']]},
{h:'Using count.index'},
{code:`resource "aws_instance" "web" {
  count         = 3
  ami           = var.ami
  instance_type = "t3.micro"
  tags = {
    Name = "web-\${count.index + 1}"   # web-1, web-2, web-3
  }
}`},
{h:'Create something only if a condition is true'},
{code:`resource "aws_eip" "web" {
  count    = var.public ? 1 : 0
  instance = aws_instance.web[0].id
}
# reference with an index: aws_eip.web[0], and guard against zero copies`},
{h:'The count problem: identity is the position'},
{svg:cnt},
{p:'Terraform tracks `web[0]`, `web[1]`, `web[2]`. If you build them from a list of names and remove the **middle** name, every later item moves down one position. Terraform sees the old `web[2]` as gone and the old `web[1]` as changed, so it may **destroy and recreate** servers you wanted to keep.'},
{h:'When count is fine'},
{ul:['N identical copies where you only ever add or remove at the end.','An on/off switch: `count = var.enabled ? 1 : 0`.']},
{note:'`count` and `for_each` cannot be used together on one resource. For named, distinct items prefer `for_each` (next lecture).'}],
src:[['count',LG+'meta-arguments/count']]};

/* ---------- 4: for_each ---------- */
L['tf:5:4']={blocks:[
{p:'`for_each` creates **one instance per item** of a map or a set. Each instance is identified by its **key**, not its position, so adding or removing items affects only those items.'},
{h:'With a set of strings'},
{code:`resource "aws_s3_bucket" "b" {
  for_each = toset(["logs", "data", "backup"])
  bucket   = "demo-\${each.key}-123"
}
# addresses: aws_s3_bucket.b["logs"], ["data"], ["backup"]`},
{h:'With a map'},
{code:`variable "servers" {
  type = map(object({
    size = string
    port = number
  }))
  default = {
    web = { size = "t3.micro", port = 80 }
    api = { size = "t3.small", port = 8080 }
  }
}

resource "aws_instance" "s" {
  for_each      = var.servers
  ami           = var.ami
  instance_type = each.value.size
  tags = {
    Name = each.key
    Port = each.value.port
  }
}`},
{t:[['Item','Meaning'],
['`each.key`','Map key, or the set value itself'],
['`each.value`','Map value (for a set, the same as the key)'],
['`aws_instance.s["web"]`','One instance by key'],
['`aws_instance.s`','A map of all instances; use `values(aws_instance.s)[*].id`']]},
{h:'Why keys are better'},
{svg:cnt},
{p:'Remove `"api"` from the map and only `aws_instance.s["api"]` is destroyed. `web` is untouched because its key did not change.'},
{h:'count or for_each?'},
{t:[['Situation','Use'],
['Items have names or ids','`for_each`'],
['N identical copies','`count`'],
['Switch a resource on or off','`count = 0 or 1` (or `for_each = {}`)'],
['Items may be added or removed in the middle','`for_each`']]},
{h:'Limits'},
{ul:['`for_each` needs a **map or set of strings**. Convert a list with `toset(list)`.','Keys must be **known at plan time** (not values like a new resource id).','You cannot use `count` and `for_each` on the same resource.']},
{note:'Common error: "The for_each argument... value depends on resource attributes that cannot be determined until apply". Build the keys from inputs you already know.'}],
src:[['for_each',LG+'meta-arguments/for_each']]};

/* ---------- 5: for expressions and splat ---------- */
L['tf:5:5']={blocks:[
{p:'A **for expression** builds a new list or map by transforming and filtering another collection. It is the Terraform way to loop over data and return a new value.'},
{svg:fe},
{h:'To a list: square brackets'},
{code:`[for s in var.names : upper(s)]
# ["WEB", "DB"]

[for s in var.names : upper(s) if s != "db"]
# ["WEB"]            (the if filters items)

[for i, s in var.names : "\${i}-\${s}"]
# ["0-web", "1-db"]  (index and value)`},
{h:'To a map: curly braces and =>'},
{code:`{for s in var.names : s => upper(s)}
# { web = "WEB", db = "DB" }

{for k, v in var.servers : k => v.size}
# { web = "t3.micro", api = "t3.small" }`},
{t:[['Brackets','Result','Syntax'],
['`[ ... ]`','List','`[for x in coll : expr]`'],
['`{ ... }`','Map','`{for x in coll : key => value}`']]},
{h:'Splat expressions'},
{p:'A **splat** `[*]` is a short form of a simple for expression: take one attribute from every item.'},
{code:`aws_instance.web[*].id
# same as [for i in aws_instance.web : i.id]

var.servers[*].port    # list of ports (for a list of objects)`},
{h:'Grouping'},
{code:`{for s in var.servers : s.env => s.name...}
# the ... after the value groups items with the same key into a list`},
{h:'Where you use them'},
{flow:['Reshape a variable into the map for_each needs','Collect ids or addresses for an output','Filter a list before creating resources','Build tags from several sources']},
{note:'Use a for expression to turn a list of objects into a map keyed by something unique, then feed it to `for_each`.'}],
src:[['for expressions',LG+'expressions/for'],['Splat expressions',LG+'expressions/splat']]};

/* ---------- 6: dynamic blocks ---------- */
L['tf:5:6']={blocks:[
{p:'Some resources contain **nested blocks** that repeat, such as several `ingress` rules in a security group. A **dynamic block** generates those nested blocks from a collection instead of writing each by hand.'},
{svg:dyn},
{h:'Without a dynamic block'},
{code:`resource "aws_security_group" "web" {
  name = "web"
  ingress {
    from_port = 80
    to_port   = 80
    protocol  = "tcp"
  }
  ingress {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
  }
}`},
{h:'With a dynamic block'},
{code:`variable "ports" {
  type    = list(number)
  default = [80, 443, 8080]
}

resource "aws_security_group" "web" {
  name = "web"

  dynamic "ingress" {
    for_each = var.ports
    content {
      from_port = ingress.value
      to_port   = ingress.value
      protocol  = "tcp"
    }
  }
}`},
{t:[['Part','Meaning'],
['`dynamic "ingress"`','Name of the nested block to generate'],
['`for_each`','The collection to loop over'],
['`content { ... }`','The body of each generated block'],
['`ingress.value` / `ingress.key`','Current item (the block name is the loop variable)'],
['`iterator = x`','Optional: rename the loop variable']]},
{h:'When not to use it'},
{ul:['If you only have two or three fixed blocks, write them out. It is easier to read.','Dynamic blocks cannot create resources, only nested blocks inside one.','Avoid nesting dynamic blocks deeply; the code becomes hard to follow.']},
{note:'A dynamic block repeats a nested **block**. `for_each` on the resource repeats the whole **resource**. Do not mix them up.'}],
src:[['Dynamic blocks',LG+'expressions/dynamic-blocks']]};

/* ---------- 7: Templates ---------- */
L['tf:5:7']={blocks:[
{p:'**Templates** create text (config files, scripts, policies) by filling placeholders with values. Terraform offers `templatefile()` for files and **string directives** for simple logic inside text.'},
{h:'templatefile'},
{p:'`templatefile(path, variables)` reads a file, replaces `${...}` placeholders with the variables you pass, and returns the text.'},
{code:`# nginx.conf.tpl
server {
  listen \${port};
  server_name \${host};
}

# main.tf
locals {
  conf = templatefile("\${path.module}/nginx.conf.tpl", {
    port = 8080
    host = "example.com"
  })
}`},
{h:'Directives: loops and conditions in text'},
{t:[['Directive','Use'],
['`%{ for x in list }...%{ endfor }`','Repeat text for every item'],
['`%{ if cond }...%{ else }...%{ endif }`','Choose text'],
['`~` next to the braces','Strip whitespace and line breaks around the directive']]},
{code:`# hosts.tpl
%{ for name, ip in servers ~}
\${ip} \${name}
%{ endfor ~}

# result for servers = { web = "10.0.0.1", db = "10.0.0.2" }
# 10.0.0.2 db
# 10.0.0.1 web`},
{h:'Inline directive example'},
{code:`locals {
  banner = "Env: \${var.env}%{ if var.env == "prod" } (PRODUCTION!)%{ endif }"
}`},
{h:'Where templates are used'},
{flow:['Start-up scripts (user data) with variables filled in','Configuration files rendered into servers','JSON or YAML documents built with variables','Messages and tags with conditional text']},
{note:'The template file is rendered with `templatefile()`; the older `template_file` data source is deprecated. In a template, only the variables you pass are visible, not your whole configuration.'}],
src:[['templatefile',LG+'functions/templatefile'],['String templates',LG+'expressions/strings#string-templates']]};

/* ---------- 8: Practical ---------- */
L['tf:5:8']={blocks:[
{p:'A lab that builds a **set of resources from one data structure** using `for_each`, a for expression and a template. It runs locally with the `local` provider, so it is free.'},
{h:'Step 1: the data'},
{code:`# main.tf
terraform {
  required_providers {
    local = { source = "hashicorp/local", version = "~> 2.5" }
  }
}

variable "servers" {
  type = map(object({
    ip   = string
    role = string
  }))
  default = {
    web1 = { ip = "10.0.1.10", role = "web" }
    web2 = { ip = "10.0.1.11", role = "web" }
    db1  = { ip = "10.0.2.10", role = "db" }
  }
}`},
{h:'Step 2: one file per server (for_each)'},
{code:`resource "local_file" "server" {
  for_each = var.servers
  filename = "out/\${each.key}.conf"
  content  = "name=\${each.key}\\nip=\${each.value.ip}\\nrole=\${each.value.role}\\n"
}`},
{h:'Step 3: a template and an inventory file'},
{p:'Create `inventory.tpl`:'},
{code:`%{ for name, s in servers ~}
\${name} ansible_host=\${s.ip} role=\${s.role}
%{ endfor ~}`},
{code:`resource "local_file" "inventory" {
  filename = "out/inventory.txt"
  content  = templatefile("\${path.module}/inventory.tpl", { servers = var.servers })
}`},
{h:'Step 4: for expressions in outputs'},
{code:`output "web_ips" {
  value = [for k, s in var.servers : s.ip if s.role == "web"]
}

output "ips_by_name" {
  value = {for k, s in var.servers : k => s.ip}
}

output "files" {
  value = [for f in local_file.server : f.filename]
}`},
{h:'Step 5: run and experiment'},
{code:`terraform init
terraform apply
cat out/inventory.txt
terraform output web_ips`},
{ul:['Add a fourth server to the map and apply: only **one** new file is created.','Remove `web1` and apply: only `out/web1.conf` is destroyed.','Check the plan addresses: `local_file.server["db1"]`.','Switch to `count` with a list and remove the first item to see the index-shift problem.']},
{t:[['You practised','Where'],
['`for_each` over a map of objects','Step 2'],
['`each.key` and `each.value`','Step 2'],
['`templatefile` with a loop directive','Step 3'],
['for expressions with `if` and map output','Step 4']]},
{note:'The same pattern builds many subnets, buckets or users from a single variable. Add a dynamic block when a resource needs repeated nested blocks.'}],
src:[['for_each',LG+'meta-arguments/for_each'],['templatefile',LG+'functions/templatefile']]};
})();
