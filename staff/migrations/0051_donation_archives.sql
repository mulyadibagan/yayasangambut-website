CREATE TABLE yg_donation_files (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES yg_donations(id),
 version INTEGER NOT NULL, purpose TEXT NOT NULL, filename TEXT NOT NULL,
 storage_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL, size INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(request_id,purpose,version)
);
CREATE TABLE yg_donation_drive (
 file_id TEXT PRIMARY KEY REFERENCES yg_donation_files(id),
 request_id TEXT NOT NULL REFERENCES yg_donations(id), root_id TEXT NOT NULL,
 drive_id TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending', web_url TEXT,
 error TEXT, retry_at INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0, lease_owner TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX yg_donation_files_request ON yg_donation_files(request_id);
CREATE INDEX yg_donation_drive_request ON yg_donation_drive(request_id);
