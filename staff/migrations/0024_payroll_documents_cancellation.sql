-- Retain every historical request and audit event. Cancellation is a soft state.
ALTER TABLE yg_payroll_requests ADD COLUMN cancelled_at TEXT;
ALTER TABLE yg_payroll_requests ADD COLUMN cancelled_by TEXT;
ALTER TABLE yg_payroll_requests ADD COLUMN cancellation_reason TEXT;
DROP INDEX yg_payroll_active_period;
CREATE UNIQUE INDEX yg_payroll_active_period ON yg_payroll_requests(period)
 WHERE status IN ('submitted','approved') AND cancelled_at IS NULL;
CREATE TABLE yg_payroll_documents (
 request_id TEXT PRIMARY KEY REFERENCES yg_payroll_requests(id),
 approval_event TEXT NOT NULL UNIQUE, object_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL,
 created_at TEXT NOT NULL
);
