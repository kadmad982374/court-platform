-- ============================================================
-- V36: Client feedback — widen department/court type CHECKs for the
--      three new Damascus-only registers.
--
-- Adds CASSATION (قسم النقض), ADMINISTRATIVE_JUDICIARY (القضاء الإداري),
-- and EXTERNAL_DISPUTES (المنازعات الخارجية) to the allowed DepartmentType
-- values. Postgres has no ALTER CONSTRAINT for CHECKs, so drop + re-add.
-- Existing rows only use the original 4 values, so the widening is safe.
-- ============================================================

ALTER TABLE departments DROP CONSTRAINT chk_departments_type;
ALTER TABLE departments ADD CONSTRAINT chk_departments_type
    CHECK (type IN ('CONCILIATION','FIRST_INSTANCE','APPEAL','EXECUTION',
                    'CASSATION','ADMINISTRATIVE_JUDICIARY','EXTERNAL_DISPUTES'));

ALTER TABLE courts DROP CONSTRAINT chk_courts_dept_type;
ALTER TABLE courts ADD CONSTRAINT chk_courts_dept_type
    CHECK (department_type IN ('CONCILIATION','FIRST_INSTANCE','APPEAL','EXECUTION',
                               'CASSATION','ADMINISTRATIVE_JUDICIARY','EXTERNAL_DISPUTES'));
