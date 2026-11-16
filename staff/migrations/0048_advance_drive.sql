CREATE TABLE IF NOT EXISTS yg_advance_drive (
 file_id TEXT PRIMARY KEY REFERENCES yg_advance_files(id),
 request_id TEXT NOT NULL REFERENCES yg_advance_requests(id),
 root_id TEXT NOT NULL, drive_id TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'pending', web_url TEXT, error TEXT,
 retry_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
 lease_owner TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS yg_advance_drive_request ON yg_advance_drive(request_id);
