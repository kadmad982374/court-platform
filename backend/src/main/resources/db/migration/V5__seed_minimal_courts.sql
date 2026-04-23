-- V5: Minimal seed of one court per (branch, department_type) so APIs return non-empty data.
-- يمكن توسعتها لاحقًا إداريًا. مرجع: الوظيفية §3.3.

INSERT INTO courts (branch_id, department_type, name_ar, chamber_support, is_active)
SELECT d.branch_id, d.type,
       CASE d.type
           WHEN 'CONCILIATION'   THEN 'محكمة الصلح - ' || b.name_ar
           WHEN 'FIRST_INSTANCE' THEN 'محكمة البداية - ' || b.name_ar
           WHEN 'APPEAL'         THEN 'محكمة الاستئناف - ' || b.name_ar
           WHEN 'EXECUTION'      THEN 'دائرة التنفيذ - ' || b.name_ar
       END,
       (d.type IN ('FIRST_INSTANCE','APPEAL')),
       TRUE
FROM departments d
JOIN branches b ON b.id = d.branch_id;

