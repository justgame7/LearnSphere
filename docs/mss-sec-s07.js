/* LearnSphere - SQL Server Security & Compliance, Section 07: Row, Column & Data Controls.
   Lectures 0-3 are core, 4 is additional content (not written yet). Needs mss-common.js. */
(function(){
const M=window.MSS,L=window.LESSONS;

/* ---------- diagrams ---------- */
const rls=M.dg(700,200,[
[10,20,150,70,'User A|tenant 5',0],[10,115,150,70,'User B|tenant 9',0],
[220,60,210,70,'Security policy|filter predicate|added by the engine',2],[490,20,200,70,'Table Orders|rows for all tenants',0],[490,115,200,70,'User sees only|own rows',2]],
[[160,55,220,80],[160,150,220,110],[430,95,490,55],[430,95,490,150]]);

const ddm=M.dg(700,170,[
[10,25,200,70,'Stored value|alice@contoso.com',0],[250,25,200,70,'Masked for users|without UNMASK|aXXX@XXXX.com',2],[490,25,200,70,'UNMASK permission|sees real value',0],
[10,115,680,40,'A display aid, not a security boundary: a user who can filter can still infer values',0]],
[[210,60,250,60],[450,60,490,60]]);

const col=M.dg(700,170,[
[10,25,200,70,'GRANT SELECT on|specific columns|to a role',2],[250,25,200,70,'DENY SELECT on|sensitive columns|where needed',0],[490,25,200,70,'SELECT * fails|for that user|queries must name columns',0],
[10,115,680,40,'Column permissions are simple and visible, and cost nothing at run time',0]],
[]);

const cls=M.dg(700,170,[
[10,25,200,70,'Discover|SSMS Data Discovery|and Classification',0],[250,25,200,70,'Label|label, information type,|rank',2],[490,25,200,70,'Use|audit records show|sensitive access',0],
[10,115,680,40,'Classification does not protect data by itself. It tells you what to protect and audit.',0]],
[[210,60,250,60],[450,60,490,60]]);

/* ---------- 0: RLS ---------- */
L['mss-sec:6:0']={blocks:[
{p:'**Row-level security (RLS)** restricts which **rows** a user can read or change. The engine adds the filter, so applications and ad hoc queries all follow the same rule.'},
{svg:rls},
{code:`CREATE SCHEMA Security;
GO
CREATE FUNCTION Security.fn_TenantPredicate(@TenantID int)
  RETURNS TABLE WITH SCHEMABINDING AS
  RETURN SELECT 1 AS allowed
         WHERE @TenantID = CAST(SESSION_CONTEXT(N'TenantID') AS int)
            OR IS_MEMBER('db_owner') = 1;
GO
CREATE SECURITY POLICY Security.TenantPolicy
  ADD FILTER PREDICATE Security.fn_TenantPredicate(TenantID) ON sales.Orders,
  ADD BLOCK  PREDICATE Security.fn_TenantPredicate(TenantID) ON sales.Orders AFTER INSERT
  WITH (STATE = ON);

-- App sets the tenant after connecting
EXEC sp_set_session_context @key = N'TenantID', @value = 5, @read_only = 1;`},
{t:[['Predicate','Effect'],
['**FILTER**','Silently removes rows from SELECT, UPDATE and DELETE'],
['**BLOCK**','Stops INSERT or UPDATE that would break the rule']]},
{note:'RLS can leak through side channels such as errors and timing for users who can write queries. Combine it with least privilege, and test with a user that has no admin rights.'}],
src:[['Row-level security',M.RD+'security/row-level-security'],['SESSION_CONTEXT',M.TS+'functions/session-context-transact-sql']]};

/* ---------- 1: DDM ---------- */
L['mss-sec:6:1']={blocks:[
{p:'**Dynamic Data Masking (DDM)** changes how a column is **shown** to users without the `UNMASK` permission. The data on disk stays the same.'},
{svg:ddm},
{code:`ALTER TABLE sales.Customers
  ALTER COLUMN Email ADD MASKED WITH (FUNCTION = 'email()');
ALTER TABLE sales.Customers
  ALTER COLUMN Phone ADD MASKED WITH (FUNCTION = 'partial(0,"XXX-XXX-",4)');
ALTER TABLE sales.Customers
  ALTER COLUMN Salary ADD MASKED WITH (FUNCTION = 'random(1000, 9999)');

GRANT UNMASK TO hr_manager;     -- sees real values

SELECT name, is_masked, masking_function FROM sys.masked_columns;`},
{t:[['Function','Shows'],
['`default()`','Default value for the type'],
['`email()`','First letter and a fixed suffix'],
['`partial(prefix, padding, suffix)`','Parts of the value'],
['`random(a, b)`','Random number in range']]},
{note:'Masking is for convenience, not protection against someone with query access. A user can still filter on the column to infer values. Use column permissions or encryption for real protection.'}],
src:[['Dynamic data masking',M.RD+'security/dynamic-data-masking'],['sys.masked_columns',M.RD+'system-catalog-views/sys-masked-columns-transact-sql']]};

/* ---------- 2: Column permissions ---------- */
L['mss-sec:6:2']={blocks:[
{p:'The simplest data control is a **column-level permission**: a user can read only the columns they are granted.'},
{svg:col},
{code:`-- Allow only some columns
GRANT SELECT ON sales.Customers (CustomerID, Name, City) TO support_staff;

-- Or deny sensitive columns while allowing the rest
GRANT SELECT ON sales.Customers TO analysts;
DENY  SELECT ON sales.Customers (NationalID, Salary) TO analysts;

-- Check
SELECT * FROM sys.fn_my_permissions('sales.Customers', 'OBJECT');`},
{h:'Another pattern: views'},
{code:`CREATE VIEW reporting.CustomerPublic AS
  SELECT CustomerID, Name, City FROM sales.Customers;
GRANT SELECT ON reporting.CustomerPublic TO support_staff;   -- no rights on the table`},
{ul:['A view hides columns and rows, and ownership chaining lets users read it without table rights.','Document **which roles can see which columns**, and review it with the data owners.']}],
src:[['Column-level permissions',M.RD+'security/authentication-access/grant-a-permission-to-a-principal'],['GRANT object permissions',M.TS+'statements/grant-object-permissions-transact-sql']]};

/* ---------- 3: Classification ---------- */
L['mss-sec:6:3']={blocks:[
{p:'You cannot protect what you have not found. **Data discovery and classification** adds labels to columns so people and tools know where sensitive data is.'},
{svg:cls},
{code:`ADD SENSITIVITY CLASSIFICATION TO sales.Customers.Email
  WITH (LABEL = 'Confidential', INFORMATION_TYPE = 'Contact Info', RANK = MEDIUM);

ADD SENSITIVITY CLASSIFICATION TO sales.Customers.NationalID
  WITH (LABEL = 'Highly Confidential', INFORMATION_TYPE = 'National ID', RANK = CRITICAL);

SELECT OBJECT_NAME(major_id) AS table_name, COL_NAME(major_id, minor_id) AS column_name,
       label, information_type, rank_desc
FROM   sys.sensitivity_classifications;`},
{h:'How to use it'},
{ul:['In SSMS use **Tasks, Data Discovery and Classification** to scan and review suggestions.','Feed labels into **auditing**: audit records can include sensitivity information.','Use the report to decide where **encryption, masking and permissions** are needed.','Keep labels aligned with your **company policy** and regulations.']}],
src:[['Data discovery and classification',M.RD+'security/sql-data-discovery-and-classification'],['sys.sensitivity_classifications',M.RD+'system-catalog-views/sys-sensitivity-classifications-transact-sql']]};

})();
