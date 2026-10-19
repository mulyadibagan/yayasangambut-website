-- Additive review evidence and durable email outbox. Historical records stay unchanged.
CREATE TABLE yg_payroll_reviews (
 token TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES yg_payroll_requests(id),
 actor_email TEXT NOT NULL, version INTEGER NOT NULL, opened_at TEXT NOT NULL,
 print_opened_at TEXT, UNIQUE(request_id,actor_email,version)
);
CREATE TABLE yg_payroll_notifications (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES yg_payroll_requests(id),
 approval_event TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 lease_until TEXT, next_attempt_at TEXT NOT NULL, created_at TEXT NOT NULL,
 sent_at TEXT, message_id TEXT, error TEXT
);
