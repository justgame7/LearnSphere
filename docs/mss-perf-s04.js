/* LearnSphere - SQL Server Performance & Tuning, Section 04: Execution Plans.
   Lectures 0-4 are core, 5-6 are additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const est=M.dg(700,160,[
[10,25,200,70,'Estimated plan|not executed|what the optimizer expects',0],[250,25,200,70,'Actual plan|executed|adds real rows and time',2],[490,25,200,70,'Compare|estimated rows vs|actual rows',2],
[10,115,680,35,'Big gaps between estimated and actual are the first clue to a bad plan',0]],
[[210,60,250,60],[450,60,490,60]]);

const flow=M.dg(700,200,[
[10,70,110,60,'Result|SELECT',2],[170,70,110,60,'Sort',0],[330,70,110,60,'Hash Match|join',0],
[500,20,180,50,'Index Seek|Customers',0],[500,130,180,50,'Clustered Index|Scan Orders',0]],
[[170,100,120,100],[330,100,280,100],[500,45,440,85],[500,155,440,115]]);

const lk=M.dg(700,170,[
[10,25,200,70,'Index Seek|jumps to rows by key|best for few rows',2],[250,25,200,70,'Index Scan|reads the whole index|ok for large share',0],[490,25,200,70,'Key Lookup|extra read per row|costly for many rows',2],
[10,115,680,40,'Fix a costly lookup with a covering index (INCLUDE the columns)',0]],
[]);

const jn=M.dg(700,190,[
[10,20,215,150,'Nested Loops',1],[25,55,185,30,'Small outer input',0],[25,95,185,30,'Indexed inner',2],[25,135,185,25,'Few rows',0],
[245,20,215,150,'Hash Match',1],[260,55,185,30,'Large inputs',0],[260,95,185,30,'Needs memory grant',2],[260,135,185,25,'No sort order needed',0],
[480,20,210,150,'Merge Join',1],[495,55,180,30,'Both inputs sorted',0],[495,95,180,30,'Very efficient',2],[495,135,180,25,'Often after index scans',0]],
[]);

const warn=M.dg(700,170,[
[10,20,200,70,'Spill to tempdb|sort or hash did not|fit its memory grant',2],[250,20,200,70,'Implicit conversion|index cannot be used|for a seek',0],[490,20,200,70,'Missing statistics|row estimates are|guesses',0],
[10,110,680,45,'The yellow triangle on an operator is never decoration. Hover over it.',0]],
[]);

/* ---------- 0: Estimated vs actual ---------- */
L['mss-perf:3:0']={blocks:[
{p:'An **execution plan** is the step-by-step description of how SQL Server runs a query. There are two kinds, and you need both.'},
{svg:est},
{t:[['Plan','How','Contains'],
['**Estimated**','Ctrl+L in SSMS, `SET SHOWPLAN_XML ON`','Operators, estimated rows and costs. The query is not run.'],
['**Actual**','Ctrl+M, then run; `SET STATISTICS XML ON`','Same plus actual rows, executions, memory used, spills.']]},
{code:`SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT o.OrderID, c.Name, o.TotalDue
FROM   sales.Orders o
JOIN   sales.Customers c ON c.CustomerID = o.CustomerID
WHERE  o.OrderDate >= '2026-01-01';`},
{h:'What to compare'},
{ul:['**Estimated vs actual rows** on each operator: big gaps mean poor statistics or a poor estimate.','**Logical reads** from STATISTICS IO: the real cost in pages.','**Elapsed time** and **CPU time** from STATISTICS TIME.','**Warnings** and **plan properties**: compile parameters, memory grant, cardinality estimator version.']},
{note:'The actual plan needs the query to run. For a long-running query, capture the estimated plan first, or use live query statistics.'}],
src:[['Display an actual execution plan',M.RD+'performance/display-an-actual-execution-plan'],['Execution plans',M.RD+'performance/execution-plans']]};

/* ---------- 1: Reading a plan ---------- */
L['mss-perf:3:1']={blocks:[
{p:'Read a plan **right to left, top to bottom**. Data flows from the leaf operators on the right toward the result on the left.'},
{svg:flow},
{h:'What to read on each operator'},
{t:[['Item','Meaning'],
['**Arrow thickness**','Relative row count flowing between operators'],
['**Cost percent**','Optimizer estimate: a guide, not a measurement'],
['**Actual rows / estimated rows**','Accuracy of the estimate'],
['**Executions**','How many times it ran: a high count under a nested loop is a flag'],
['**Warnings**','Triangle icon: spills, conversions, missing statistics']]},
{h:'Common operators'},
{t:[['Operator','Role'],
['**Index Seek / Scan**','Reads an index'],
['**Key Lookup / RID Lookup**','Fetches missing columns from the table'],
['**Nested Loops / Hash Match / Merge Join**','Joins'],
['**Sort**','Orders rows, needs memory'],
['**Stream / Hash Aggregate**','Group by'],
['**Compute Scalar**','Calculates an expression']]},
{note:'Operator cost percentages come from estimates. When the estimate is wrong, the percentages point at the wrong place. Trust actual rows and times.'}],
src:[['Logical and physical operators reference',M.RD+'showplan-logical-and-physical-operators-reference'],['Execution plans',M.RD+'performance/execution-plans']]};

/* ---------- 2: Scans, seeks, lookups ---------- */
L['mss-perf:3:2']={blocks:[
{p:'**Seek**, **scan** and **lookup** are the three data access patterns. Which is right depends on how many rows the query needs.'},
{svg:lk},
{h:'Seek or scan?'},
{ul:['A **seek** is good when the predicate selects **few rows**.','A **scan** is fine, and often best, when the query needs a **large share** of the table.','A scan of a **tiny** table is normal.']},
{h:'SARGable predicates'},
{p:'A predicate is **SARGable** when the engine can use an index seek for it. Wrapping the column in a function usually removes that.'},
{code:`-- Not SARGable: function on the column
SELECT * FROM sales.Orders WHERE YEAR(OrderDate) = 2026;

-- SARGable: range on the bare column
SELECT * FROM sales.Orders
WHERE  OrderDate >= '2026-01-01' AND OrderDate < '2027-01-01';

-- Implicit conversion: column is varchar, parameter is nvarchar
SELECT * FROM sales.Customers WHERE AccountCode = N'A100';`},
{h:'Fixing a costly key lookup'},
{code:`-- Query needs OrderDate and TotalDue for a customer
CREATE NONCLUSTERED INDEX IX_Orders_Customer
  ON sales.Orders (CustomerID) INCLUDE (OrderDate, TotalDue);`},
{note:'Do not add an index for every lookup. Check how many times it executes and how much of the query cost it is.'}],
src:[['Clustered and nonclustered indexes described',M.RD+'indexes/clustered-and-nonclustered-indexes-described'],['Index design guide',M.RD+'sql-server-index-design-guide']]};

/* ---------- 3: Joins ---------- */
L['mss-perf:3:3']={blocks:[
{p:'SQL Server has three physical join algorithms. The optimizer picks one by **estimated row counts** and available indexes.'},
{svg:jn},
{t:[['Join','How it works','Best when'],
['**Nested Loops**','For each outer row, search the inner input','Few outer rows and an index on the inner side'],
['**Hash Match**','Builds a hash table from one input and probes with the other','Large, unsorted inputs; needs a memory grant'],
['**Merge Join**','Walks two sorted inputs together','Both sorted by the join key']]},
{h:'What goes wrong'},
{ul:['**Nested loops** chosen for a **large** outer input: millions of lookups. Often caused by an estimate that was too low.','**Hash match** with too little memory: **spill** to tempdb.','A **sort** before a merge join that costs more than the join.']},
{h:'Adaptive joins'},
{p:'From SQL Server 2017 (batch mode) the engine can **switch** between nested loops and hash at run time based on actual row counts. This is part of Intelligent Query Processing, covered in Section 7.'},
{note:'Join hints such as LOOP or HASH force the algorithm and can be wrong for other data volumes. Prefer fixing statistics and indexes. Use hints only as a last resort and document why.'}],
src:[['Joins',M.RD+'performance/joins'],['Query processing architecture guide',M.RD+'query-processing-architecture-guide']]};

/* ---------- 4: Spills and warnings ---------- */
L['mss-perf:3:4']={blocks:[
{p:'Warnings in a plan are **direct evidence** of a problem. Learn the main ones and what each usually means.'},
{svg:warn},
{t:[['Warning','Meaning','Usual fix'],
['**Sort / hash spill**','Memory grant too small, work goes to tempdb','Fix estimates, update statistics, index to avoid the sort'],
['**Implicit conversion**','Data types differ, conversion of the column','Match parameter and column types'],
['**Missing statistics**','No statistics on a column','Create or enable auto-create statistics'],
['**No join predicate**','Cartesian product','Fix the query'],
['**Missing index** hint','Optimizer suggests an index','Evaluate, do not blindly create']]},
{h:'Row goals'},
{p:'Clauses such as **TOP**, **EXISTS** and `OPTION (FAST n)` make the optimizer assume it can **stop early**. It may choose a plan that is fast if matching rows are common and very slow if they are rare. The plan shows an estimate **without row goal** for comparison.'},
{code:`-- TOP can drive a nested loops plan that scans far more than expected
SELECT TOP (10) * FROM sales.Orders o
WHERE  o.TotalDue > 10000 ORDER BY o.OrderDate DESC;

-- Cached plans that spilled the most (2017 and later)
SELECT TOP (10) qs.total_spills, qs.execution_count, st.text
FROM   sys.dm_exec_query_stats qs
CROSS  APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER  BY qs.total_spills DESC;`},
{note:'The actual plan operator properties show "Memory Grant", "Spill Level" and "Spilled data". Start there for any query that is slow only on large inputs.'}],
src:[['Execution plan warnings',M.RD+'performance/display-an-actual-execution-plan'],['Showplan operators reference',M.RD+'showplan-logical-and-physical-operators-reference']]};

})();
