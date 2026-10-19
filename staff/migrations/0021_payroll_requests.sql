-- Additive workflow only: never modifies existing finance transactions or balances.
CREATE TABLE yg_payroll_requests (
 id TEXT PRIMARY KEY, period TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','submitted','returned','approved')),
 creator TEXT NOT NULL REFERENCES users(id), creator_email TEXT NOT NULL, items TEXT NOT NULL,
 total INTEGER NOT NULL CHECK(total > 0), notes TEXT NOT NULL DEFAULT '', review_note TEXT NOT NULL DEFAULT '',
 version INTEGER NOT NULL DEFAULT 1, last_event TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 submitted_at TEXT, reviewed_at TEXT, reviewer_email TEXT
);
CREATE UNIQUE INDEX yg_payroll_active_period ON yg_payroll_requests(period) WHERE status IN ('submitted','approved');
CREATE TABLE yg_payroll_events (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES yg_payroll_requests(id), actor_email TEXT NOT NULL,
 action TEXT NOT NULL, version INTEGER NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX yg_payroll_event_request ON yg_payroll_events(request_id,version);
CREATE TABLE yg_payroll_files (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES yg_payroll_requests(id), object_key TEXT NOT NULL UNIQUE,
 filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, actor_email TEXT NOT NULL, created_at TEXT NOT NULL
);
