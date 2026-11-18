CREATE TABLE yg_pjum_review_emails (
 id TEXT PRIMARY KEY,
 request_id TEXT NOT NULL REFERENCES yg_advance_requests(id),
 payload TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL,
 lease_until TEXT,
 sent_at TEXT
);
CREATE INDEX yg_pjum_review_emails_pending ON yg_pjum_review_emails(next_attempt_at) WHERE sent_at IS NULL;

