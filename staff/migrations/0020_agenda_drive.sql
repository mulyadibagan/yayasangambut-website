CREATE TABLE agenda_drive_connection (
 id INTEGER PRIMARY KEY CHECK(id=1), user_id TEXT NOT NULL REFERENCES users(id),
 email TEXT NOT NULL, refresh_token TEXT NOT NULL, root_id TEXT NOT NULL,
 folder_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'connected',
 updated_at TEXT NOT NULL
);
CREATE TABLE agenda_drive_oauth_states (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 nonce TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL
);
ALTER TABLE agenda_files ADD COLUMN drive_file_id TEXT;
ALTER TABLE agenda_files ADD COLUMN drive_web_url TEXT;
ALTER TABLE agenda_files ADD COLUMN drive_lease_until INTEGER NOT NULL DEFAULT 0;
