/* LearnSphere - Security, Section 07: Data Protection: Redaction, Masking, VPD & Database Vault.
   Lectures 0-6 are core, 7+ are additional content (not written yet). Needs ora-common.js. */
(function(){
const O=window.ORA,L=window.LESSONS,D=O.D;
const SG=O.D+'dbseg/';
const AS=O.D+'asoag/';

/* ---------- diagrams ---------- */
const layers=O.dg(700,210,[
[10,10,680,190,'Who can see which value',1],
[30,45,200,60,'Redaction|same row, masked|value on display',0],
[250,45,200,60,'VPD / Label Security|only some rows',0],
[470,45,200,60,'Database Vault|blocks even DBAs|from the data',2],
[30,125,640,55,'Masking (non-production): irreversible, real values replaced with realistic fake ones',0]],[]);

/* ---------- 0: Discovery ---------- */
L['ora-sec:6:0']={blocks:[
{p:'You cannot protect data you do not know about. **Discovery** finds sensitive columns and **classifies** them.'},
{t:[['Approach','Tool'],
['**Pattern search**','Search column names and comments for CARD, SSN, EMAIL, SALARY'],
['**Data sampling**','Check values with patterns (card numbers, phone numbers)'],
['**DBSAT `discover`**','Scans and reports likely sensitive columns'],
['**Oracle Data Safe**','Cloud service: sensitive data discovery and masking'],
['**Enterprise Manager Data Masking and Subsetting**','Application Data Models']]},
{code:`SELECT owner, table_name, column_name, data_type
FROM dba_tab_columns
WHERE owner NOT IN (SELECT username FROM dba_users WHERE oracle_maintained=\'Y\')
  AND REGEXP_LIKE(column_name, \'(CARD|SSN|SALARY|PASSWORD|EMAIL|PHONE|DOB)\', \'i\')
ORDER BY owner, table_name;`},
{h:'Classification'},
{ul:['Label each column with a category: personal, financial, health, credentials.','Record owner and the rule that applies (mask, encrypt, audit).','Keep the list as a controlled document.']},
{note:'The list drives every control in this section. Start here and keep it up to date after each release.'}],
src:[['Data discovery',SG]]};

/* ---------- 1: Data Redaction ---------- */
L['ora-sec:6:1']={blocks:[
{p:'**Data Redaction** changes values **in query results** at run time, based on rules. The stored data is unchanged, and the application needs no change.'},
{code:`BEGIN
  DBMS_REDACT.ADD_POLICY(
    object_schema => \'APP\', object_name => \'CUSTOMERS\', column_name => \'CARD_NO\',
    policy_name   => \'redact_card\',
    function_type => DBMS_REDACT.PARTIAL,
    function_parameters => \'VVVVFVVVVFVVVVFVVVV,VVVV-VVVV-VVVV-VVVV,*,1,12\',
    expression    => \'SYS_CONTEXT(\'\'USERENV\'\',\'\'SESSION_USER\'\') != \'\'PAYMENTS\'\'\');
END;
/`},
{t:[['Function type','Result'],
['`FULL`','Value replaced with a constant (0, space)'],
['`PARTIAL`','Part masked, for example last four digits shown'],
['`RANDOM`','Random value of the same type'],
['`REGEXP`','Pattern-based'],
['`NONE`','Policy off']]},
{h:'Notes'},
{ul:['The policy applies to what the **user sees**. Data still moves in joins and WHERE clauses with the real value.','Users with `EXEMPT REDACTION POLICY` see real values.','Needs the Advanced Security option.']},
{note:'Redaction is for display. It is not encryption and does not stop users from inferring values by queries. Combine with auditing.'}],
src:[['Data Redaction',AS]]};

/* ---------- 2: VPD ---------- */
L['ora-sec:6:2']={blocks:[
{p:'**Virtual Private Database (VPD)**, also **row-level security**, adds a **predicate** to each query, based on who runs it. Each user sees only their rows.'},
{svg:layers},
{code:`-- a policy function returns the predicate
CREATE OR REPLACE FUNCTION app.region_pred(p_schema VARCHAR2, p_obj VARCHAR2) RETURN VARCHAR2 AS
BEGIN
  RETURN \'region = SYS_CONTEXT(\'\'APP_CTX\'\',\'\'REGION\'\')\';
END;
/
BEGIN
  DBMS_RLS.ADD_POLICY(
    object_schema => \'APP\', object_name => \'ORDERS\', policy_name => \'ORDERS_REGION\',
    function_schema => \'APP\', policy_function => \'REGION_PRED\',
    statement_types => \'SELECT,INSERT,UPDATE,DELETE\');
END;
/`},
{flow:['User runs SELECT * FROM orders','Oracle calls the policy function','The predicate is appended: WHERE region = (user region)','The user sees only their rows']},
{t:[['Good','Watch out'],
['Transparent to the application','Policy functions run on each statement. Keep them fast.'],
['Applies to all access paths','Users with `EXEMPT ACCESS POLICY` bypass it'],
['Works with views and joins','Complex predicates can change plans']]},
{note:'The context (`APP_CTX`) must be set by a trusted package at login. A user must not be able to change it.'}],
src:[['Virtual Private Database',SG]]};

/* ---------- 3: Label Security ---------- */
L['ora-sec:6:3']={blocks:[
{p:'**Oracle Label Security (OLS)** controls row access by **labels**. A user label (clearance) must dominate the row label.'},
{t:[['Concept','Meaning'],
['**Level**','Hierarchy: PUBLIC < CONFIDENTIAL < SECRET'],
['**Compartment**','Topic: FINANCE, HR'],
['**Group**','Organization unit: EMEA, US'],
['**Row label**','Level + compartments + groups attached to a row'],
['**User label**','The user clearance for reading and writing']]},
{code:`-- outline (policy administration needs LBACSYS)
EXEC SA_SYSDBA.CREATE_POLICY(\'ACCESS_POLICY\',\'OLS_COL\');
EXEC SA_COMPONENTS.CREATE_LEVEL(\'ACCESS_POLICY\',10,\'P\',\'PUBLIC\');
EXEC SA_COMPONENTS.CREATE_LEVEL(\'ACCESS_POLICY\',20,\'S\',\'SECRET\');
EXEC SA_POLICY_ADMIN.APPLY_TABLE_POLICY(\'ACCESS_POLICY\',\'APP\',\'DOCUMENTS\');`},
{h:'VPD or OLS?'},
{t:[['','VPD','OLS'],
['**Rules**','Any predicate you write','Label dominance model'],
['**Effort**','Code a function','Define labels once, apply'],
['**Use**','Custom row filters','Government, classification schemes']]},
{note:'OLS is a licensed option. If the rule is "user sees own region rows", VPD is simpler. Use OLS when you have a real classification scheme.'}],
src:[['Oracle Label Security',O.D+'olsag/']]};

/* ---------- 4: Database Vault ---------- */
L['ora-sec:6:4']={blocks:[
{p:'**Database Vault** limits what **privileged users** can do with application data. Even `SYSDBA` can be blocked from reading an application schema.'},
{t:[['Component','Meaning'],
['**Realm**','Protects a set of objects. Only realm participants (and authorized users) can access them, even with powerful privileges.'],
['**Command rule**','Allows or blocks a statement under a condition (for example `DROP TABLE` only in a change window)'],
['**Rule set and factor**','Conditions: time, IP address, program'],
['**Separation of duties**','Vault owner and account manager roles keep DBAs from granting themselves access']]},
{code:`-- realm over an application schema
BEGIN
  DBMS_MACADM.CREATE_REALM(realm_name=>\'HR Realm\', description=>\'Protect HR\', enabled=>DBMS_MACUTL.G_YES,
        audit_options=>DBMS_MACUTL.G_REALM_AUDIT_FAIL);
  DBMS_MACADM.ADD_OBJECT_TO_REALM(\'HR Realm\',\'HR\',\'%\',\'%\');
  DBMS_MACADM.ADD_AUTH_TO_REALM(\'HR Realm\',\'HR_APP\');
END;
/`},
{h:'Typical results'},
{ul:['A DBA with `SELECT ANY TABLE` gets "insufficient privileges" on HR tables.','Only the application account and approved users access them.','Every attempt is audited.']},
{note:'Database Vault changes how administration works. Test patching, backups and upgrades with it on. It is a licensed option.'}],
src:[['Database Vault',O.D+'dvadm/']]};

/* ---------- 5: Masking and subsetting ---------- */
L['ora-sec:6:5']={blocks:[
{p:'**Masking** replaces real sensitive values with **realistic fake values**, permanently, so a copy can be used in test and development.'},
{t:[['Technique','Example'],
['**Substitution**','Replace names from a list of fake names'],
['**Shuffle**','Mix values of a column among rows'],
['**Format preserving**','Card number replaced with another valid-looking number'],
['**Fixed or random**','Set a constant or random string'],
['**Nulling**','Remove'],
['**Subsetting**','Copy only a part of the data (a percentage, a date range) with referential integrity']]},
{flow:['Copy production to a staging area (secured)','Run masking jobs on the copy','Verify no real values remain','Release the masked copy to test and development']},
{h:'Rules'},
{ul:['Mask **before** data leaves the production boundary (or in a secured staging zone).','Preserve **referential integrity**: the same input gets the same output across tables.','Keep **data meaning**: dates remain plausible, formats valid.','Test that the application works with masked data.']},
{note:'A non-production copy of unmasked data is one of the most common causes of data leaks. Make masking part of the refresh procedure.'}],
src:[['Data masking',SG]]};

/* ---------- 6: Practical ---------- */
L['ora-sec:6:6']={blocks:[
{p:'**Protect a customer table three ways.** The table has name, region and card number.'},
{t:[['Goal','Control'],
['Support staff see card numbers as `XXXX-XXXX-XXXX-1234`','Data Redaction (partial)'],
['Regional managers see only customers in their region','VPD with a context'],
['The DBA cannot read the table','Database Vault realm (if licensed)']]},
{code:`-- 1. redaction
BEGIN DBMS_REDACT.ADD_POLICY(\'APP\',\'CUSTOMERS\',\'CARD_NO\',\'redact_card\', function_type=>DBMS_REDACT.PARTIAL,
  function_parameters=>\'VVVVFVVVVFVVVVFVVVV,VVVV-VVVV-VVVV-VVVV,X,1,12\', expression=>\'1=1\'); END;
/
-- 2. VPD
BEGIN DBMS_RLS.ADD_POLICY(\'APP\',\'CUSTOMERS\',\'REGION_POLICY\',\'APP\',\'REGION_PRED\',\'SELECT\'); END;
/
-- 3. test as different users
SELECT name, region, card_no FROM app.customers;`},
{h:'Check your result'},
{t:[['As user','Result'],
['Support user','All rows (or all in scope), card_no shows only last four digits'],
['EMEA manager','Only EMEA rows'],
['DBA with SELECT ANY TABLE (with a realm)','Insufficient privileges'],
['Audit trail','Realm violation recorded']]},
{note:'Each control answers a different question. Redaction hides values, VPD hides rows, Vault limits privileged users. None replaces the others.'}],
src:[['Data protection',SG]]};

})();
