/* LearnSphere - GoldenGate, Section 07: Topologies, Active-Active & Conflict Detection.
   Lectures 0-5 are core, 6-10 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const topo=O.dg(700,250,[
[10,10,215,110,'One-way',1],[25,50,80,40,'A',2],[125,50,80,40,'B',0],
[245,10,215,110,'Bidirectional',1],[260,50,80,40,'A',2],[360,50,80,40,'B',2],
[480,10,210,110,'Hub and spoke',1],[535,40,100,34,'Hub',2],[490,85,60,28,'S1',0],[570,85,60,28,'S2',0],[650,85,30,28,'S3',0],
[10,130,215,110,'Cascading',1],[25,170,50,40,'A',2],[90,170,50,40,'B',0],[155,170,50,40,'C',0],
[245,130,445,110,'Choose by need: copy, both-ways writes, central distribution, or chain of copies',1]],
[[105,70,125,70],[340,70,360,70],[360,80,340,80]]);

const loop=O.dg(700,160,[
[10,40,150,70,'Site A|user changes row|(tagged normally)',0],[210,40,150,70,'Extract A|captures the change|tag = A',2],[410,40,150,70,'Replicat B|applies it|(sets a special tag)',2],[600,40,90,70,'Extract B|skips tagged|changes',2]],
[[160,75,210,75],[360,75,410,75],[560,75,600,75]]);

/* ---------- 0: Topologies ---------- */
L['ora-gg:6:0']={blocks:[
{p:'A **topology** is the shape of your replication: who sends to whom. Four shapes cover almost every case.'},
{svg:topo},
{t:[['Topology','Description','Use'],
['**One-way**','A sends to B','Migration, reporting, integration'],
['**Bidirectional (active-active)**','A and B send to each other and both accept writes','Two sites, local writes, high availability'],
['**Hub and spoke**','A central database sends to many (or receives from many)','Distribution, consolidation'],
['**Cascading**','A sends to B, B sends to C','Chain of copies, saving load on A']]},
{h:'Design questions'},
{ul:['Do users write at both sides? Then you need conflict handling.','How many targets? A trail can feed several paths.','What happens when a link is down? Trails hold changes until it returns.','Who is the source of truth for each table?']},
{flow:['Draw the data flow for each table','Choose the topology','Decide where conflicts can occur','Plan loop prevention and conflict rules']},
{note:'The simplest topology that meets the need is the best. Active-active adds real design work: conflicts, keys and sequences.'}],
src:[['Topologies',O.GG]]};

/* ---------- 1: Loop prevention ---------- */
L['ora-gg:6:1']={blocks:[
{p:'In a bidirectional setup, a change from A is applied on B. B must **not send it back** to A, or it would loop forever. GoldenGate prevents loops by recognising its own changes.'},
{svg:loop},
{h:'Ways to prevent loops'},
{t:[['Method','How'],
['**Exclude the apply user**','Extract on B ignores changes made by the Replicat database user: `TRANLOGOPTIONS EXCLUDEUSER ggadmin`'],
['**Tags**','The Replicat marks its changes with a tag. Extract skips changes with that tag: `TRANLOGOPTIONS EXCLUDETAG`.'],
['**Integrated capture ignores replicated work**','Integrated Extract can recognise Replicat transactions, using tags']]},
{code:`-- Extract on each side
TRANLOGOPTIONS EXCLUDETAG +
-- or
TRANLOGOPTIONS EXCLUDEUSER ggadmin`},
{h:'Test'},
{flow:['Insert a row on A','It appears on B','Check B Extract: it did not capture the replicated insert','Insert a row on B and see it on A, without a loop']},
{note:'Always test loop prevention with a few rows before you put real traffic on a bidirectional flow. A loop can flood the trail and the databases within minutes.'}],
src:[['Loop prevention',O.GG]]};

/* ---------- 2: CDR ---------- */
L['ora-gg:6:2']={blocks:[
{p:'When both sides can change the **same row** at about the same time, a **conflict** occurs. **Conflict detection and resolution (CDR)** decides which change wins.'},
{h:'Conflict types'},
{t:[['Type','What happened'],
['**Update-update**','Both sides changed the same row at the same time'],
['**Update-delete**','One side updated, the other deleted'],
['**Insert-insert (duplicate key)**','Both sides inserted the same key'],
['**Missing row**','An update or delete finds no row on the target']]},
{h:'Detection and resolution in the Replicat'},
{code:`MAP shop.customers, TARGET shop.customers,
  COMPARECOLS (ON UPDATE KEYINCLUDING (email, phone)),
  RESOLVECONFLICT (UPDATEROWEXISTS, (DEFAULT, USEMAX (last_update))),
  RESOLVECONFLICT (INSERTROWEXISTS, (DEFAULT, USEMAX (last_update))),
  RESOLVECONFLICT (DELETEROWMISSING, (DEFAULT, DISCARD));`},
{t:[['Part','Meaning'],
['`COMPARECOLS`','Which columns to compare to detect a conflict (before values)'],
['`RESOLVECONFLICT`','What to do for each type'],
['`USEMAX (column)`','The change with the larger value (for example a timestamp) wins'],
['`DISCARD`','Write to the discard file and ignore'],
['`OVERWRITE`','Apply the incoming change']]},
{h:'Needs'},
{ul:['`ADD TRANDATA ... ALLCOLS` so before values are available.','A reliable **timestamp or version column** for "latest wins".','A rule for each type of conflict, agreed with the business.']},
{note:'The best CDR is **no conflicts**: design so each row is mostly changed at one site. CDR is a safety net, not the main plan.'}],
src:[['Conflict detection and resolution',O.GG]]};

/* ---------- 3: Automatic CDR ---------- */
L['ora-gg:6:3']={blocks:[
{p:'Writing CDR rules for every table is a lot of work. **Automatic CDR** lets the Oracle Database detect and resolve conflicts for you, with a built-in rule.'},
{h:'How it works'},
{ul:['You enable it per table in the database.','The database adds a hidden **timestamp column** to the table, updated on every change.','Replicat applies a change only if its timestamp is newer ("latest timestamp wins").']},
{code:`-- On both databases, for each table
EXEC DBMS_GOLDENGATE_ADM.ADD_AUTO_CDR(schema_name => 'SHOP', table_name => 'CUSTOMERS');
EXEC DBMS_GOLDENGATE_ADM.ALTER_AUTO_CDR(schema_name => 'SHOP', table_name => 'CUSTOMERS', tombstone_deletes => TRUE);

SELECT * FROM dba_auto_cdr_tables;`},
{t:[['Setting','Meaning'],
['**Tombstone deletes**','Remember deleted rows for a while, so an old update does not bring them back'],
['**Hidden timestamp column**','Maintained by the database']]},
{h:'When to use it'},
{t:[['Use Automatic CDR','Use manual CDR'],
['Oracle to Oracle, simple "latest wins" is acceptable','Special business rules, or non-Oracle systems'],
['Many tables','A few tables with different rules']]},
{flow:['Decide that "latest change wins" is right for the table','Enable Automatic CDR on both sides','Test conflicts with parallel updates','Monitor the conflict statistics']},
{note:'"Latest wins" can lose a valid change. Use it where that is acceptable, or design to avoid conflicts. Check conflict counts regularly.'}],
src:[['Automatic CDR',O.GG],['DBMS_GOLDENGATE_ADM',D+'arpls/DBMS_GOLDENGATE_ADM.html']]};

/* ---------- 4: Sequences and keys ---------- */
L['ora-gg:6:4']={blocks:[
{p:'In an active-active setup, **keys** are a real design problem. If both sites create new rows with the same key, you get conflicts at every insert.'},
{h:'Sequences'},
{t:[['Approach','How','Notes'],
['**Separate ranges**','Site A uses 1 to 1 billion, site B 1 billion and above','Simple, needs planning'],
['**Odd and even**','Site A uses odd, site B uses even numbers (`START WITH 1 INCREMENT BY 2` and `START WITH 2 INCREMENT BY 2`)','Easy to extend to more sites with larger steps'],
['**Add a site column**','Key = (site id, sequence)','Clear origin of each row'],
['**GUIDs**','Globally unique identifiers','No collisions, larger keys']]},
{code:`-- Site A
CREATE SEQUENCE shop.order_seq START WITH 1 INCREMENT BY 2;
-- Site B
CREATE SEQUENCE shop.order_seq START WITH 2 INCREMENT BY 2;`},
{h:'Other design rules'},
{ul:['Every replicated table needs a **primary key**.','Do not replicate the sequence objects. Each site has its own.','Triggers that fire on apply can double changes: disable or guard them on the replicated side.','Avoid designs where both sites update the same hot row all the time.']},
{flow:['List the tables and who writes them','Give each site its own key space','Review triggers and constraints for the replicated flow','Test with writes on both sides']},
{note:'A good key design removes most conflicts before they happen. It costs little at design time, and a lot to fix later.'}],
src:[['Designing for active-active',O.GG]]};

/* ---------- 5: Practical ---------- */
L['ora-gg:6:5']={blocks:[
{p:'Build a **bidirectional** replication between two databases, add loop prevention and conflict handling, and test a conflict.'},
{h:'Setup'},
{flow:['Prepare both databases as source and target (user, logging, parameter)','Create Extract, path and Replicat from A to B','Create Extract, path and Replicat from B to A','Add loop prevention on both Extracts','Add conflict handling to both Replicats','Use odd and even sequences']},
{code:`-- Extract on each side
EXTRACT extA
USERIDALIAS a_alias DOMAIN OracleGoldenGate
EXTTRAIL aa
TRANLOGOPTIONS EXCLUDETAG +
TABLE pdb1.shop.customers;

-- Replicat on each side
REPLICAT repB
USERIDALIAS b_alias DOMAIN OracleGoldenGate
MAP pdb1.shop.customers, TARGET shop.customers,
  COMPARECOLS (ON UPDATE ALL),
  RESOLVECONFLICT (UPDATEROWEXISTS, (DEFAULT, USEMAX (last_update)));`},
{h:'Tests'},
{t:[['Test','Expected'],
['Insert on A','Appears on B, no loop'],
['Insert on B','Appears on A, no loop'],
['Update the same row on A and B at the same time','The row with the later `last_update` wins on both sides'],
['Statistics','`STATS REPLICAT` shows a conflict resolved'],
['Discard file','Contains only rows you expect']]},
{h:'Challenge'},
{ul:['Stop the path from A to B, make changes on both sides, restart it, and check what happens.','Remove COMPARECOLS and see how the behaviour changes.']},
{note:'Active-active is the most complex topology. Keep the lab small and write down what you learn from each test.'}],
src:[['Bidirectional replication',O.GG]]};

})();
