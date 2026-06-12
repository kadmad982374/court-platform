-- ============================================================
-- V42: Client feedback — external-disputes court (DAMASCUS).
--
-- At least one court is required per (branch, department_type) so that
-- OrganizationService.validateConsistency() passes when a case is filed
-- under EXTERNAL_DISPUTES.
-- ============================================================

INSERT INTO courts (branch_id, department_type, name_ar, chamber_support, is_active)
SELECT b.id, 'EXTERNAL_DISPUTES', 'سجل المنازعات الخارجية', FALSE, TRUE
FROM branches b
WHERE b.code = 'DAMASCUS'
  AND NOT EXISTS (
      SELECT 1 FROM courts ct
       WHERE ct.branch_id = b.id
         AND ct.department_type = 'EXTERNAL_DISPUTES'
  );
