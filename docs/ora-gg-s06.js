/* LearnSphere - GoldenGate, Section 06: Mapping, Filtering & Transformation.
   Lectures 0-6 are core, 7-11 are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;

/* ---------- diagrams ---------- */
const pipe=O.dg(700,190,[
[10,45,130,70,'Source table|hr.employees|all columns',0],[180,45,140,70,'TABLE in Extract|choose tables,|filter rows',2],[360,45,140,70,'MAP in Replicat|rename, map|columns, transform',2],[540,45,150,70,'Target table|hr_copy.emp|selected columns',0],
[10,130,680,50,'Select in Extract (less data in the trail), transform in Replicat (target specific)',1]],
[[140,80,180,80],[320,80,360,80],[500,80,540,80]]);

/* ---------- 0: TABLE and MAP ---------- */
L['ora-gg:5:0']={blocks:[
{p:'Two parameters define **what is replicated** and **where it goes**: `TABLE` in the Extract, and `MAP` in the Replicat.'},
{svg:pipe},
{t:[['Parameter','Where','Meaning'],
['**TABLE**','Extract','Which source tables to capture, with optional filters'],
['**MAP ... TARGET ...**','Replicat','Which target table receives the data, with mapping and transformation'],
['**TABLEEXCLUDE**','Extract','Skip tables that match a wildcard'],
['**MAPEXCLUDE**','Replicat','Skip tables on apply']]},
{code:`-- Extract
TABLE pdb1.shop.orders;
TABLE pdb1.shop.customers;
TABLE pdb1.hr.*;                       -- wildcard: every table of the schema
TABLEEXCLUDE pdb1.hr.audit_log;

-- Replicat
MAP pdb1.shop.orders, TARGET shop.orders;
MAP pdb1.shop.customers, TARGET shop.cust_copy;     -- different target name
MAP pdb1.hr.*, TARGET hr_copy.*;                     -- different target schema`},
{h:'Wildcards'},
{t:[['Pattern','Matches'],
['`hr.*`','All tables in schema hr'],
['`hr.emp*`','Tables starting with emp'],
['`*.*`','All tables (use with care)']]},
{flow:['List the tables with TABLE in the Extract','Map each to its target with MAP in the Replicat','Use wildcards for whole schemas','Exclude what you do not need']},
{note:'Capture only what you will use. Every table adds redo to read and data in the trail. Wildcards are convenient, but check what they match.'}],
src:[['TABLE and MAP',O.GG]]};

/* ---------- 1: Filtering ---------- */
L['ora-gg:5:1']={blocks:[
{p:'Filtering reduces what goes to the target. You can filter **rows** and **columns**.'},
{h:'Rows'},
{code:`-- In the Extract: only European orders
TABLE pdb1.shop.orders, WHERE (region = 'EU');

-- In the Replicat: filter with a function
MAP pdb1.shop.orders, TARGET shop.orders, FILTER (@STRFIND(status, 'CANCELLED') = 0);`},
{t:[['Clause','Meaning'],
['`WHERE (...)`','A simple condition on column values (SQL-like)'],
['`FILTER (...)`','A more flexible filter using GoldenGate functions'],
['Filter in the **Extract**','Less data in the trail and over the network'],
['Filter in the **Replicat**','Different targets can apply different filters from one trail']]},
{h:'Columns'},
{code:`-- Do not send the credit card column
TABLE pdb1.shop.customers, COLS (id, name, country, email);
TABLE pdb1.shop.customers, COLSEXCEPT (credit_card);

MAP pdb1.shop.customers, TARGET shop.customers, COLMAP (USEDEFAULTS);`},
{t:[['Clause','Meaning'],
['`COLS (...)`','Only these columns'],
['`COLSEXCEPT (...)`','All except these columns']]},
{h:'Privacy'},
{ul:['Filter sensitive columns in the **Extract**, so they never reach the trail or the network.','Test that the target works without the excluded column (null allowed or defaulted).']},
{note:'Row filters on updates can be tricky: an update that moves a row into or out of the filter looks like a change of membership. Test updates, not only inserts.'}],
src:[['Filtering data',O.GG]]};

/* ---------- 2: Column mapping ---------- */
L['ora-gg:5:2']={blocks:[
{p:'**COLMAP** maps columns when the target table has different names or a different shape.'},
{code:`MAP pdb1.shop.orders, TARGET dw.fact_orders,
 COLMAP (USEDEFAULTS,
         order_id    = id,
         customer_nm = @UPPER(customer),
         order_dt    = @DATE('YYYY-MM-DD', 'YYYY-MM-DD HH:MI:SS', order_date),
         load_ts     = @DATENOW(),
         src_system  = 'SHOP');`},
{t:[['Part','Meaning'],
['`USEDEFAULTS`','Map all columns with the same name automatically'],
['`target = source`','Map a source column to a target column'],
['`target = @function(...)`','Compute a value with a function'],
['`target = \'constant\'`','Fixed value']]},
{h:'Useful functions'},
{t:[['Function','Does'],
['`@STRCAT(a, b)`','Join text'],
['`@STREXT(col, start, end)`','Part of a string'],
['`@UPPER`, `@LOWER`','Change case'],
['`@IF(cond, a, b)`','Conditional value'],
['`@DATE`, `@DATENOW`','Convert and generate dates'],
['`@NUMSTR`, `@STRNUM`','Convert between number and text'],
['`@GETENV(...)`','Read information about the transaction and process']]},
{h:'Where to transform'},
{flow:['Simple renames: COLMAP in the Replicat','Computed or enriched columns: functions in COLMAP','Complex logic: SQLEXEC or procedures (next lecture)','Heavy transformations: do them in the target after load']},
{note:'Keep transformations simple and visible. The more you do in GoldenGate, the harder replication is to troubleshoot.'}],
src:[['Column mapping and conversion functions',O.GG]]};

/* ---------- 3: SQLEXEC ---------- */
L['ora-gg:5:3']={blocks:[
{p:'**SQLEXEC** runs a SQL statement or a stored procedure from GoldenGate during apply. It is used for **lookups** and for **custom logic**.'},
{h:'Lookup'},
{code:`MAP pdb1.shop.orders, TARGET dw.fact_orders,
 SQLEXEC (ID lookup_cust,
          QUERY 'SELECT cust_key FROM dw.dim_customer WHERE cust_id = :cid',
          PARAMS (cid = customer_id)),
 COLMAP (USEDEFAULTS, customer_key = lookup_cust.cust_key);`},
{t:[['Part','Meaning'],
['`ID name`','A name to refer to the result'],
['`QUERY`','The SQL to run, with bind variables'],
['`PARAMS`','Bind values from the source row'],
['`name.column`','Use a returned value in COLMAP']]},
{h:'Stored procedure'},
{code:`MAP pdb1.shop.orders, TARGET shop.orders,
 SQLEXEC (SPNAME audit_proc, PARAMS (p_id = id, p_total = total));`},
{h:'Cost'},
{ul:['Each SQLEXEC is an extra database call for every row. It can slow apply a lot.','Cache lookup tables where possible, or load reference data into the target first.','Avoid SQLEXEC for large volumes. Use set-based processing in the database.']},
{flow:['Decide if the lookup is really needed','Test the speed with realistic volume','Index the lookup columns','Replace by a join later if performance suffers']},
{note:'A lookup in the Replicat is easy to write and easy to forget. Measure the lag before and after you add one.'}],
src:[['SQLEXEC',O.GG]]};

/* ---------- 4: DML and error handling ---------- */
L['ora-gg:5:4']={blocks:[
{p:'Real systems produce errors: a row is missing, a key exists, a constraint fails. GoldenGate lets you decide what to do, per error and per table.'},
{h:'Control which operations are applied'},
{t:[['Parameter','Effect'],
['`IGNOREINSERTS`, `IGNOREUPDATES`, `IGNOREDELETES`','Skip that kind of operation'],
['`INSERTALLRECORDS`','Turn every change into an insert (for history tables)'],
['`GETUPDATEBEFORES`','Include the before image of updates'],
['`NOCOMPRESSDELETES`, `NOCOMPRESSUPDATES`','Send all columns, not only changed ones']]},
{h:'Error handling'},
{code:`REPERROR (DEFAULT, ABEND)                  -- stop on any error (safe default)
REPERROR (1403, DISCARD)                   -- row not found: write to discard file and continue
REPERROR (1, EXCEPTION)                    -- duplicate key: send to an exception handling MAP
DISCARDFILE ./dirrpt/rep1.dsc, APPEND, MEGABYTES 100`},
{t:[['Action','Meaning'],
['`ABEND`','Stop the process. Safest.'],
['`DISCARD`','Write the row to the discard file and continue'],
['`IGNORE`','Skip silently (rarely a good idea)'],
['`EXCEPTION`','Run an exception MAP, for example to log the row in a table'],
['`RETRYOP`','Try again (for temporary errors)']]},
{h:'Principle'},
{ul:['Stop on unknown errors. Continue only on errors you understand.','Always write a discard file and review it.','Alert when a Replicat abends or discards rows.']},
{note:'`HANDLECOLLISIONS` (section 5) is for loading only. Do not use REPERROR with IGNORE to hide a design problem. Fix the cause.'}],
src:[['Error handling',O.GG]]};

/* ---------- 5: DDL replication ---------- */
L['ora-gg:5:5']={blocks:[
{p:'Tables change: columns are added, indexes created. **DDL replication** sends these changes to the target, so the structure stays in step.'},
{code:`-- Extract
DDL INCLUDE MAPPED
DDLOPTIONS REPORT

-- Replicat
DDLERROR DEFAULT ABEND
DDLOPTIONS REPORT`},
{t:[['Option','Meaning'],
['`DDL INCLUDE MAPPED`','Replicate DDL for tables that are in TABLE/MAP'],
['`DDL INCLUDE ALL`','All DDL (for example in a full copy)'],
['`DDL EXCLUDE ...`','Skip some objects or operations'],
['`DDLOPTIONS REPORT`','Write DDL information to the report']]},
{h:'What to know'},
{ul:['Target and source must have **compatible structures**.','For heterogeneous targets, DDL is usually **not** replicated. You change the target by hand.','DDL replication needs the correct logging and privileges.','Test ALTER TABLE ADD COLUMN, CREATE INDEX and DROP, since each behaves differently.']},
{h:'Change process'},
{flow:['Plan the change with the application team','Apply to the source with DDL replication enabled','Check the Replicat applied it','Update filters and mappings if needed']},
{note:'Many teams turn DDL replication off for heterogeneous targets and handle schema changes with a change process. That keeps the target under control.'}],
src:[['DDL replication',O.GG]]};

/* ---------- 6: Practical ---------- */
L['ora-gg:5:6']={blocks:[
{p:'Add **filtering and transformation** to your replication from section 5.'},
{h:'Goals'},
{ul:['Replicate only orders with a total over 100.','Do not send the `customer` name column.','Add a computed column and a load timestamp in the target.']},
{h:'Target table'},
{code:`CREATE TABLE shop.orders_dw (
  order_id    NUMBER PRIMARY KEY,
  total       NUMBER,
  total_class VARCHAR2(10),
  load_ts     TIMESTAMP
);`},
{h:'Parameter files'},
{code:`-- Extract ext1
TABLE pdb1.shop.orders, WHERE (total > 100), COLSEXCEPT (customer);

-- Replicat rep1
REPERROR (DEFAULT, ABEND)
DISCARDFILE ./dirrpt/rep1.dsc, APPEND, MEGABYTES 50
MAP pdb1.shop.orders, TARGET shop.orders_dw,
  COLMAP (order_id = id, total = total,
          total_class = @IF(total > 1000, 'HIGH', 'NORMAL'),
          load_ts = @DATENOW());`},
{h:'Test'},
{code:`INSERT INTO shop.orders VALUES (10, 'Gamma', 50);      -- filtered out
INSERT INTO shop.orders VALUES (11, 'Delta', 500);     -- replicated
INSERT INTO shop.orders VALUES (12, 'Epsilon', 5000);  -- replicated, HIGH
COMMIT;
SELECT * FROM shop.orders_dw;`},
{h:'Check your result'},
{t:[['Check','Expected'],
['Order 10','Not on the target'],
['Order 11','On the target, class NORMAL'],
['Order 12','On the target, class HIGH'],
['`customer` column','Not sent'],
['`load_ts`','Filled with the apply time'],
['Discard file','Empty (no errors)']]},
{note:'Restart the Extract and Replicat with the new parameter files. Parameter changes take effect only after a restart.'}],
src:[['Mapping and transformation',O.GG]]};

})();
