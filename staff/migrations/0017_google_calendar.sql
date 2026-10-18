CREATE TABLE calendar_connections (
 user_id TEXT PRIMARY KEY REFERENCES users(id), email TEXT NOT NULL,
 refresh_token TEXT NOT NULL, calendar_id TEXT NOT NULL DEFAULT '',
 generation TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'connected',
 last_synced TEXT, last_attempt TEXT, error TEXT NOT NULL DEFAULT '',
 lease_until INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE calendar_oauth_states (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), nonce TEXT NOT NULL,
 verifier TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE calendar_events (
 user_id TEXT NOT NULL REFERENCES users(id), source_key TEXT NOT NULL,
 event_id TEXT NOT NULL, content_hash TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(user_id,source_key)
);
