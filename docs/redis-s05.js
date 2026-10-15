/* LearnSphere - Redis, Section 05: Streams.
   Lectures 0-6 are core. Needs redis-common.js. */
(function(){
const K=window.RD,L=window.LESSONS;

const log=K.dg(700,170,[
[10,10,680,150,'A stream is an append-only log',1],
[30,55,110,60,'id 101-0|temp=21',0],[160,55,110,60,'id 102-0|temp=22',0],[290,55,110,60,'id 103-0|temp=22',0],[420,55,110,60,'...',0],[560,55,110,60,'XADD appends|here',2]],
[[140,85,160,85],[270,85,290,85],[400,85,420,85],[530,85,560,85]]);

const group=K.dg(700,230,[
[10,10,680,210,'Consumer group: each entry goes to one consumer',1],
[30,85,110,60,'Stream|orders',2],[210,85,130,60,'Group|billing',0],
[430,40,120,44,'consumer A',0],[430,100,120,44,'consumer B',0],[430,160,120,44,'consumer C',0],[590,100,90,44,'XACK',2]],
[[140,115,210,115],[340,100,430,62],[340,115,430,122],[340,130,430,182],[550,122,590,122]]);

const claim=K.dg(700,200,[
[10,10,680,180,'Recovering work from a dead consumer',1],
[30,60,130,60,'Entry delivered|to consumer A',0],[210,60,130,60,'A crashes|entry stays pending',0],[390,60,130,60,'XAUTOCLAIM|min-idle-time',2],[570,60,100,60,'Consumer B|processes, XACK',0]],
[[160,90,210,90],[340,90,390,90],[520,90,570,90]]);

/* ---------- 0 ---------- */
L['redis:4:0']={blocks:[
{p:'A **stream** is an append-only log of entries. Each entry has a unique, ordered **ID** and a set of field-value pairs. Streams are the Redis structure for event logs, work distribution with acknowledgement and message history.'},
{svg:log},
{h:'Entry IDs'},
{p:'An ID has the form `<milliseconds>-<sequence>`. With `*` Redis generates it from the server clock, guaranteeing it is always greater than the last. IDs are the position in the log, so they can be used as cursors.'},
{code:`XADD sensor:1 * temp 21.4 humidity 40
# "1760534400000-0"
XLEN sensor:1`},
{h:'What makes a stream different'},
{t:[['Property','List','Pub/Sub','Stream'],
['Messages persist after delivery','No','No','Yes, until trimmed'],
['Several independent readers','No','Yes (live only)','Yes, by ID or group'],
['Acknowledgement and retry','Manual','No','Built in (groups)'],
['Replay from a point','No','No','Yes']]},
{note:'Streams are stored as a radix tree of compact listpacks, so appends and range reads by ID are efficient and memory use is low for small entries.'}],
src:[['Streams',K.DT+'streams/'],['XADD',K.CMD+'xadd/']]};

/* ---------- 1 ---------- */
L['redis:4:1']={blocks:[
{p:'Writing is `XADD`. Reading is either by **range** (a snapshot of history) or by **XREAD** (follow new entries).'},
{h:'Range reads'},
{code:`XADD events * type login user ana
XADD events * type logout user ana
XRANGE events - + COUNT 10
XRANGE events 1760534400000 1760534500000
XREVRANGE events + - COUNT 1
XLEN events`},
{p:'`-` and `+` mean the smallest and greatest possible ID. A timestamp alone is a valid bound.'},
{h:'Following a stream'},
{code:`XREAD COUNT 10 STREAMS events 0           # from the start
XREAD BLOCK 5000 STREAMS events $         # only new entries
XREAD BLOCK 0 STREAMS events 1760534400000-0`},
{t:[['Argument','Meaning'],
['0','Everything from the beginning'],
['$','Only entries added after this call'],
['An ID','Entries with an ID greater than it'],
['BLOCK ms','Wait for new data. 0 waits forever'],
['COUNT n','Limit entries returned']]},
{note:'A reader must remember the **last ID** it processed and ask for entries after it. With `$` in a loop you can miss entries added between calls, so use the last returned ID from the second call onward.'}],
src:[['XREAD',K.CMD+'xread/'],['XRANGE',K.CMD+'xrange/']]};

/* ---------- 2 ---------- */
L['redis:4:2']={blocks:[
{p:'A **consumer group** lets several workers share a stream so each entry is processed by **one** of them. The server tracks which entries were delivered and which were acknowledged.'},
{svg:group},
{code:`XGROUP CREATE orders billing $ MKSTREAM
XREADGROUP GROUP billing worker-a COUNT 10 BLOCK 5000 STREAMS orders >
# process the entry ...
XACK orders billing 1760534400000-0`},
{flow:['Create a group on the stream (start from $ for new, 0 for all)','A consumer calls XREADGROUP with > to receive entries never delivered to the group','Redis records each entry in the group pending list for that consumer','The consumer processes the entry and calls XACK','Acknowledged entries leave the pending list']},
{h:'Key points'},
{ul:['Several groups can read the same stream independently, each with its own position.','The special ID `>` means new entries. Any other ID reads that consumer own pending history.','Consumers are created on first use and tracked by name.','Acknowledgement does not delete the entry. Trimming is separate.']},
{note:'If a consumer never acknowledges, the entry stays pending forever. That is by design: it gives at-least-once delivery, so processing must be idempotent.'}],
src:[['Consumer groups',K.DT+'streams/#consumer-groups'],['XREADGROUP',K.CMD+'xreadgroup/']]};

/* ---------- 3 ---------- */
L['redis:4:3']={blocks:[
{p:'Each group keeps a **pending entries list (PEL)**: entries delivered but not acknowledged. If a worker dies, its entries remain there until another consumer **claims** them.'},
{svg:claim},
{code:`XPENDING orders billing                      # summary
XPENDING orders billing - + 10               # detail
XPENDING orders billing IDLE 60000 - + 10    # idle over a minute
XAUTOCLAIM orders billing worker-b 60000 0-0 COUNT 10
XCLAIM orders billing worker-b 60000 1760534400000-0`},
{t:[['Command','Use'],
['XPENDING','See pending entries, owners, idle time and delivery count'],
['XAUTOCLAIM','Scan and claim idle entries in one call (Redis 6.2+)'],
['XCLAIM','Claim specific entries'],
['XGROUP DELCONSUMER','Remove a consumer and its pending entries']]},
{h:'Dead letters'},
{p:'Each pending entry has a delivery counter. When it passes a limit your application chooses (for example 5), move the entry to a separate "dead letter" stream with `XADD`, then `XACK` the original so it stops cycling.'},
{note:'Never claim with a small idle time. A slow but healthy consumer could be doing the work, and claiming it causes duplicate processing.'}],
src:[['XAUTOCLAIM',K.CMD+'xautoclaim/'],['XPENDING',K.CMD+'xpending/']]};

/* ---------- 4 ---------- */
L['redis:4:4']={blocks:[
{p:'A stream grows until you trim it. Without a retention rule it consumes memory without bound.'},
{h:'Trimming'},
{code:`XADD events MAXLEN ~ 100000 * type login
XADD events MINID ~ 1760000000000 * type login
XTRIM events MAXLEN ~ 100000
XTRIM events MINID 1760000000000
XDEL events 1760534400000-0`},
{t:[['Strategy','Meaning'],
['MAXLEN n','Keep roughly or exactly the newest n entries'],
['MINID id','Drop entries older than an ID (time based retention)'],
['~ (approximate)','Trim only whole internal nodes. Much cheaper, slightly more than requested'],
['= (exact)','Exact count, more work per trim']]},
{h:'Choosing a retention'},
{ul:['Use `MAXLEN ~` for a simple cap.','Use `MINID ~` for "keep the last 24 hours".','Make sure slow consumers can still read: trimming past a group position loses unread entries.']},
{note:'`XDEL` removes an entry but the space is reclaimed lazily. It does not change the stream length counters of consumers. Trimming is the normal way to bound a stream.'}],
src:[['XTRIM',K.CMD+'xtrim/']]};

/* ---------- 5 ---------- */
L['redis:4:5']={blocks:[
{p:'Several commands let you see what a stream and its groups are doing.'},
{code:`XINFO STREAM events
XINFO STREAM events FULL
XINFO GROUPS events
XINFO CONSUMERS events billing
XLEN events`},
{t:[['What to read','Where'],
['Length and first and last IDs','XINFO STREAM'],
['Number of consumers, pending count, last delivered ID','XINFO GROUPS'],
['Lag (entries not yet delivered to the group)','XINFO GROUPS, field lag'],
['Per consumer pending and idle time','XINFO CONSUMERS'],
['Memory used','MEMORY USAGE events']]},
{h:'What to watch'},
{ul:['**Lag** keeps rising: consumers are too slow or stopped.','**Pending** keeps rising with high idle time: failures, or missing acknowledgements.','**Length** keeps rising: trimming is missing or too loose.','Stale consumers: remove them with `XGROUP DELCONSUMER`.']},
{note:'Recent Redis versions add commands that delete and acknowledge together and control whether a deleted entry is also removed from other groups. They suit workloads where many groups read one stream. Check the release notes of your version.'}],
src:[['XINFO',K.CMD+'xinfo/'],['XINFO GROUPS',K.CMD+'xinfo-groups/']]};

/* ---------- 6 ---------- */
L['redis:4:6']={blocks:[
{p:'Redis offers three messaging primitives. They are easy to confuse and the choice decides reliability.'},
{t:[['','List (queue)','Pub/Sub','Stream'],
['Delivery','One consumer takes an item','Every subscriber, live only','One consumer per group, many groups'],
['Persistence of messages','Until popped','None','Until trimmed'],
['Offline subscriber','Items wait','Misses messages','Reads later from its position'],
['Acknowledgement','Manual with LMOVE','None','XACK and PEL'],
['Replay','No','No','Yes'],
['Complexity','Lowest','Low','Moderate'],
['Typical use','Simple background jobs','Live notifications, cache invalidation','Event logs, reliable job processing']]},
{h:'Rules of thumb'},
{ul:['Messages can be lost and that is fine: Pub/Sub.','One worker pool and light needs: list.','You need history, retries, several independent consumers or lag metrics: stream.','Very high fan-out to many clients with no retention: Pub/Sub, or sharded Pub/Sub in a cluster.']}],
src:[['Streams',K.DT+'streams/'],['Pub/Sub',K.D+'develop/pubsub/']]};
})();
