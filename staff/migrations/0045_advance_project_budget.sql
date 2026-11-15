-- Pending approvals and completed disbursements reserve the same activity ceiling.
-- Drafts do not reserve funds. Serialize competing submissions in SQLite itself.
CREATE TRIGGER yg_advance_budget_guard BEFORE UPDATE OF status,payload ON yg_advance_requests
WHEN NEW.status NOT IN ('draft','returned','cancelled')
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM json_each(NEW.payload,'$.allocations') a
  WHERE json_extract(a.value,'$.amount') + COALESCE((
   SELECT SUM(json_extract(b.value,'$.amount'))
   FROM yg_advance_requests r,json_each(r.payload,'$.allocations') b
   WHERE r.id<>NEW.id AND r.status NOT IN ('draft','returned','cancelled')
    AND json_extract(r.payload,'$.project_id')=json_extract(NEW.payload,'$.project_id')
    AND json_extract(b.value,'$.code')=json_extract(a.value,'$.code')
  ),0) > json_extract(a.value,'$.budget')-json_extract(a.value,'$.legacyCommitted')
 ) THEN RAISE(ABORT,'ADVANCE_BUDGET_EXCEEDED') END;
END;

