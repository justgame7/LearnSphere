/* LearnSphere - SQL Server Security & Compliance quiz, Section 7: Row, Column & Data Controls.
   Format: see pg-quiz.js. window.QUIZZES['mss-sec:6']. lec = lecture index in the section. */
window.QUIZZES=window.QUIZZES||{};
window.QUIZZES['mss-sec:6']={qs:[
{q:'What does **row-level security** control?',
 o:['Which rows a user can read or change','Which columns are encrypted','Which servers can connect','Backup frequency'],
 a:0,why:'RLS adds predicates so users only see or modify permitted rows.',lec:0},
{q:'Which objects implement **RLS**?',
 o:['Inline table-valued function','Security policy','Linked server','Trigger on login'],
 a:[0,1],why:'A predicate function is bound to a table by a security policy.',lec:0},
{q:'Which predicate type **blocks writes** that break the rule?',
 o:['BLOCK','FILTER','MASK','AUDIT'],
 a:0,why:'BLOCK predicates stop INSERT and UPDATE that would violate the rule. FILTER only hides rows.',lec:0},
{q:'Is **Dynamic Data Masking** a strong security boundary?',
 o:['No, it is a display aid','Yes, always','Only on Enterprise','Only with TDE'],
 a:0,why:'Users who can run queries can infer masked values.',lec:1},
{q:'Which permission shows **unmasked** data?',
 o:['UNMASK','VIEW DEFINITION','CONTROL','ALTER'],
 a:0,why:'Users with UNMASK see the real values.',lec:1},
{q:'Which statement allows a role to read **only some columns**?',
 o:['GRANT SELECT ON table (col1, col2) TO role','GRANT TABLE TO role','ALTER ROLE col','DENY ALL'],
 a:0,why:'Column permissions list the allowed columns.',lec:2},
{q:'What happens when a user without access to a column runs **SELECT ***?',
 o:['The query fails with a permission error','It returns NULL columns','It returns all columns','It is ignored'],
 a:0,why:'SELECT * includes the denied column, which raises an error.',lec:2},
{q:'What is **data classification** for?',
 o:['Labeling sensitive columns so they can be protected and audited','Encrypting data','Backing up data','Compressing data'],
 a:0,why:'Labels show where sensitive data lives and feed audit and policy.',lec:3},
{q:'Which catalog view lists **sensitivity labels**?',
 o:['sys.sensitivity_classifications','sys.masked_columns','sys.columns only','sys.certificates'],
 a:0,why:'sys.sensitivity_classifications lists labels and information types.',lec:3}
]};
