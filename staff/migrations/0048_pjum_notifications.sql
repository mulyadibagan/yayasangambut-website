CREATE TABLE IF NOT EXISTS yg_pjum_notifications (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES yg_advance_requests(id),
 payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0, lease_until TEXT, next_attempt_at TEXT NOT NULL,
 sent_at TEXT, message_id TEXT, error TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS yg_pjum_notifications_due ON yg_pjum_notifications(status,next_attempt_at);
